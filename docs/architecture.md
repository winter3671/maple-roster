# Maple Roster 파일 구조 및 아키텍처 기획

작성일: 2026-10-07 (KST). 메이플스토리 가계부의 구조와 설계 원칙을 정리한다. 캐릭터·보스·사냥·지출 장부, API 연동과 백업은 구현되어 있다. 아래 파일 트리에는 설계 시 검토한 확장 항목도 포함하며 실제 구현은 저장소의 src와 각 기능 문서를 기준으로 확인한다.

## 개발 방향

프론트엔드는 React + TypeScript + Tailwind CSS, 백엔드는 TypeScript + SQLite로 구성한다. 백엔드 코드는 Electron main 프로세스에서 실행하고, 화면은 renderer 프로세스에서 실행한다. 프론트엔드와 백엔드는 폴더, 빌드 경계, 공개 인터페이스로 분리한다.

앱은 하나의 저장소와 하나의 package.json을 사용한다. Electron이 앱 실행과 창 관리를 담당하며, backend는 계산·저장·API 연동을 담당한다. 별도의 HTTP 서버나 로그인 서버는 사용하지 않는다. HTTP API가 필요해지면 backend 서비스 앞에 HTTP 어댑터를 추가할 수 있도록 Electron 의존 코드를 desktop에 둔다.

주요 처리 흐름은 화면 입력 → 요청 검증 → 업무 처리 → DB 저장 → 결과 표시다. 처음부터 모든 기능의 빈 파일을 만들지 않고, 기능 하나를 이 흐름으로 완성한 다음 확장한다.

## 선택 기술과 범위

| 영역 | 선택 | 목적 |
| --- | --- | --- |
| 데스크톱 | Electron | 창, 앱 생명주기, 파일 선택, 안전한 키 보관 |
| UI | React + TypeScript | 화면과 입력 컴포넌트 |
| 스타일 | Tailwind CSS v4 | 공통 색상·간격과 화면 스타일 |
| 개발 빌드 | electron-vite | main·preload·renderer 빌드 구성 |
| DB | SQLite + Node.js 내장 node:sqlite | 로컬 저장과 원자적인 거래 처리 |
| 검증 | 공유 계약의 런타임 검증 함수 | IPC 입력값과 백업 데이터 검증 |
| 테스트 | Vitest | 정산 규칙과 DB 통합 테스트 |

라이브러리 버전은 호환성을 확인하고 lockfile로 고정한다. better-sqlite3 대신 내장 node:sqlite를 사용하여 네이티브 모듈 재빌드 없이 개발한다. Electron에 포함된 Node.js의 SQLite 지원을 실행 검증했다. ORM과 전역 상태 라이브러리는 초기 필수 항목으로 두지 않는다.

## 의존 관계

```text
frontend → window.maple API → preload → IPC handlers → backend services
                                                       ├→ domain 계산
                                                       ├→ repositories → SQLite
                                                       └→ integrations → NEXON API
```

- frontend는 backend, Electron, Node.js 모듈을 직접 import하지 않는다.
- backend는 React, Electron을 import하지 않는다. 외부 의존은 생성자나 함수 인자로 전달한다.
- desktop은 backend를 조립하고 IPC 요청을 서비스에 전달한다.
- shared는 DTO, 호출 계약, 오류 코드, 런타임 입력 검증만 담는다. DB 행 구조와 넥슨 응답 전체를 화면에 노출하지 않는다.
- shared는 frontend·backend·desktop 어느 쪽도 import하지 않는다. preload가 런타임 검증 등을 import할 경우 sandbox에 맞도록 번들에 포함한다.
- 프론트엔드의 숫자 포맷은 표시만 담당하고, 확정 수익 계산은 backend가 담당한다.

## 예정 파일 구조

```text
maple-roster/
├─ package.json                       # 실행·빌드·검사 명령
├─ package-lock.json                  # npm 의존성 버전 고정
├─ electron.vite.config.ts            # 실제 엔트리 위치와 renderer Tailwind 플러그인
├─ tsconfig.json                      # 프로젝트 참조
├─ tsconfig.frontend.json             # DOM 환경, frontend + shared
├─ tsconfig.backend.json              # Node 환경, desktop + backend + shared
├─ vitest.config.ts                   # 계산 및 DB 테스트 설정
├─ eslint.config.mjs                  # 코드 검사와 영역 간 import 제한
├─ .gitignore                         # 빌드 결과·로컬 DB·키 파일 제외
├─ resources/
│  └─ app-icon.png
├─ docs/
│  ├─ planning.md                    # 제품 범위와 집계 규칙
│  ├─ architecture.md                # 이 문서
│  ├─ database.md                    # 구현 전 테이블·관계 구체화 예정
│  └─ references/nexon-scheduler.yaml
└─ src/
   ├─ desktop/
   │  ├─ main/
   │  │  ├─ index.ts                 # 앱 준비·종료 시 처리
   │  │  ├─ window.ts                # BrowserWindow와 보안 설정
   │  │  ├─ bootstrap.ts             # DB·클라이언트·서비스 조립
   │  │  ├─ ipc/
   │  │  │  ├─ register-handlers.ts
   │  │  │  ├─ character.handlers.ts
   │  │  │  ├─ boss.handlers.ts
   │  │  │  ├─ hunting.handlers.ts
   │  │  │  ├─ ledger.handlers.ts
   │  │  │  ├─ dashboard.handlers.ts
   │  │  │  ├─ settings.handlers.ts
   │  │  │  └─ backup.handlers.ts
   │  │  └─ adapters/
   │  │     ├─ secret-store.ts       # safeStorage로 API 키 보관
   │  │     └─ file-dialogs.ts       # 백업·내보내기 경로 선택
   │  └─ preload/
   │     └─ index.ts                 # contextBridge로 window.maple 노출
   ├─ frontend/
   │  ├─ index.html
   │  ├─ main.tsx                    # React 시작점
   │  ├─ app/
   │  │  ├─ App.tsx                  # 초기에는 메뉴 상태로 화면 전환
   │  │  └─ AppLayout.tsx            # Sidebar + Header + 본문
   │  ├─ components/
   │  │  ├─ ui/
   │  │  │  ├─ Button.tsx
   │  │  │  ├─ Input.tsx
   │  │  │  ├─ Select.tsx
   │  │  │  └─ Dialog.tsx
   │  │  ├─ layout/Sidebar.tsx
   │  │  ├─ CharacterPicker.tsx
   │  │  ├─ PeriodPicker.tsx
   │  │  └─ MesoAmount.tsx
   │  ├─ features/
   │  │  ├─ characters/
   │  │  │  ├─ CharactersPage.tsx
   │  │  │  ├─ CharacterForm.tsx
   │  │  │  ├─ CharacterCard.tsx
   │  │  │  ├─ useCharacters.ts
   │  │  │  └─ characters.api.ts
   │  │  ├─ bosses/
   │  │  │  ├─ BossesPage.tsx
   │  │  │  ├─ BossWeeklyTable.tsx
   │  │  │  ├─ BossPresetForm.tsx
   │  │  │  ├─ BossSettlementForm.tsx
   │  │  │  ├─ useBosses.ts
   │  │  │  └─ bosses.api.ts
   │  │  ├─ hunting/
   │  │  │  ├─ HuntingPage.tsx
   │  │  │  ├─ HuntingSessionForm.tsx
   │  │  │  ├─ HuntingSessionList.tsx
   │  │  │  ├─ useHunting.ts
   │  │  │  └─ hunting.api.ts
   │  │  ├─ ledger/
   │  │  │  ├─ LedgerPage.tsx
   │  │  │  ├─ TransactionForm.tsx
   │  │  │  ├─ DropSaleForm.tsx
   │  │  │  ├─ useLedger.ts
   │  │  │  └─ ledger.api.ts
   │  │  ├─ dashboard/
   │  │  │  ├─ DashboardPage.tsx
   │  │  │  ├─ SummaryCards.tsx
   │  │  │  ├─ IncomeTrend.tsx
   │  │  │  ├─ useDashboard.ts
   │  │  │  └─ dashboard.api.ts
   │  │  └─ settings/
   │  │     ├─ SettingsPage.tsx
   │  │     ├─ ApiKeyForm.tsx
   │  │     ├─ BackupPanel.tsx
   │  │     └─ settings.api.ts
   │  ├─ lib/
   │  │  ├─ bridge.ts                # window.maple 접근과 공통 오류 처리
   │  │  └─ format.ts                # 메소·시간·날짜 표시
   │  ├─ styles/
   │  │  ├─ index.css                # Tailwind import, 전역 스타일
   │  │  └─ theme.css                # 색상·폰트·간격 토큰
   │  └─ types/global.d.ts           # window.maple 타입 선언
   ├─ backend/
   │  ├─ database/
   │  │  ├─ connection.ts            # 연결, foreign_keys, WAL 설정
   │  │  ├─ migrate.ts               # 적용한 migration 추적
   │  │  ├─ unit-of-work.ts          # 서비스가 여러 저장을 원자적으로 실행
   │  │  └─ migrations/
   │  │     ├─ 001_characters.sql
   │  │     ├─ 002_ledger.sql
   │  │     ├─ 003_hunting.sql
   │  │     ├─ 004_bosses.sql
   │  │     └─ 005_drops_sales_sync.sql
   │  ├─ modules/
   │  │  ├─ characters/
   │  │  │  ├─ character.service.ts
   │  │  │  └─ character.repository.ts
   │  │  ├─ bosses/
   │  │  │  ├─ boss.service.ts
   │  │  │  └─ boss.repository.ts
   │  │  ├─ hunting/
   │  │  │  ├─ hunting.service.ts
   │  │  │  └─ hunting.repository.ts
   │  │  ├─ ledger/
   │  │  │  ├─ ledger.service.ts
   │  │  │  └─ ledger.repository.ts
   │  │  ├─ drops/
   │  │  │  ├─ drop-sale.service.ts
   │  │  │  └─ drop.repository.ts
   │  │  ├─ dashboard/
   │  │  │  ├─ dashboard.service.ts
   │  │  │  └─ dashboard.repository.ts
   │  │  ├─ settings/settings.service.ts
   │  │  └─ backup/backup.service.ts
   │  ├─ domain/
   │  │  ├─ money.ts                 # 정수 금액·분배·수수료 계산
   │  │  ├─ periods.ts               # KST와 일간·주간·월간 기간
   │  │  ├─ hunting-profit.ts         # 사냥 회차와 시간당 수익
   │  │  ├─ boss-profit.ts            # 결정석 예상 수익
   │  │  └─ drop-settlement.ts        # 판매 수량·잔여 수량·내 몫
   │  ├─ integrations/nexon/
   │  │  ├─ nexon.client.ts           # 인증 헤더·타임아웃·호출 제한 대응
   │  │  ├─ nexon.types.ts            # 넥슨 응답 타입
   │  │  ├─ character.mapper.ts       # 응답을 내부 모델로 변환
   │  │  └─ scheduler.mapper.ts       # 보스 이름·난이도·완료 상태 변환
   │  ├─ ports/secret-store.ts        # 키 보관 인터페이스
   │  ├─ data/boss-catalog.json       # 안정적인 보스 ID와 초기화 주기
   │  ├─ data/boss-prices.json        # 적용일별 가격, DB에 버전별 반영
   │  └─ tests/
   │     ├─ money.test.ts
   │     ├─ periods.test.ts
   │     ├─ hunting-profit.test.ts
   │     ├─ drop-sale.integration.test.ts
   │     └─ boss-sync.integration.test.ts
   └─ shared/
      ├─ contracts/
      │  ├─ app-api.ts               # window.maple의 공개 메서드 타입
      │  ├─ character.contract.ts
      │  ├─ boss.contract.ts
      │  ├─ hunting.contract.ts
      │  ├─ ledger.contract.ts
      │  ├─ dashboard.contract.ts
      │  ├─ settings.contract.ts
      │  └─ backup.contract.ts
      ├─ ipc/channels.ts             # 허용한 채널 이름
      ├─ errors.ts                   # 사용자용 오류 코드와 결과 타입
      └─ validation.ts               # 공통 문자열·정수·날짜 검증
```

## 파일별 역할과 요청 처리

| 파일 종류 | 담당 | 넣지 않는 코드 |
| --- | --- | --- |
| Page.tsx | 화면 배치와 상태 표시 | SQL, 넥슨 API 호출 |
| Form.tsx | 입력값, 사용자에게 보여줄 검증 메시지 | 수익 확정, DB 쓰기 |
| useFeature.ts | 조회·저장 상태, 재조회, 오류 표시 | 정산 규칙 |
| feature.api.ts | 공유 DTO로 bridge 메서드 호출 | 임의 IPC 채널 호출 |
| handlers.ts | 호출 출처·입력 검증, 서비스 호출, 오류 매핑 | 업무 계산, SQL |
| service.ts | 하나의 업무 흐름, 트랜잭션과 중복 방지 | React, Electron 창 제어 |
| repository.ts | 매개변수 바인딩 SQL, 행 매핑 | 파티 분배 계산 |
| domain/*.ts | 입력으로 결과를 계산하는 순수 함수 | API, DB, 현재 시각 직접 참조 |

예를 들어 사냥 회차 저장은 다음 순서로 처리한다.

1. HuntingSessionForm에서 캐릭터·날짜·시간·메소·소모 비용을 입력한다.
2. useHunting이 hunting.api의 createSession을 호출한다.
3. preload가 허용된 hunting:create 채널로 요청을 보낸다.
4. hunting.handlers가 요청 출처와 런타임 입력을 검증한다. TypeScript 타입만 믿지 않는다.
5. hunting.service가 회차와 연결된 수입·지출을 하나의 DB 트랜잭션으로 저장한다.
6. 결과 DTO를 화면에 반환하고 회차 목록과 요약을 재조회한다.

window.maple은 characters.list/create/syncProfile, bosses.listPeriod/savePreset/setClear/settleCrystal/syncCompletion, hunting.list/create/update/remove, ledger.list/createManual/sellDrops, dashboard.summary, settings.setApiKey/getConnectionStatus, backup.export/import 같은 명시적인 메서드만 제공한다. API 키를 다시 읽어 반환하는 메서드는 제공하지 않는다.

IPC 요청의 반환값은 성공 데이터 또는 정해진 오류 코드·메시지로 통일한다. 예: VALIDATION_ERROR, API_UNAVAILABLE, PERMISSION_DENIED, INSUFFICIENT_DROP_QUANTITY, DATABASE_ERROR. 원본 스택과 키를 화면에 반환하지 않는다. 등록·판매 요청에는 요청 ID를 사용해 재시도와 중복 클릭으로 같은 거래가 생기지 않게 한다.

현재 드랍 구현은 `drops.list/createLot/updateLot/removeLot/createSale/updateSale/cancelSale`을 preload에 제공한다. 화면은 `frontend/features/drops`, 업무 규칙·SQL은 `backend/modules/drops`, 입력 계약은 `shared/contracts/drop.contract.ts`에 둔다. 현재 구현은 한 판매를 한 획득 묶음에 연결하고 판매 수량을 `drop_sales`에 저장한다. 아래의 `drop_sale_allocations`는 여러 묶음을 한 판매로 정산할 때 확장할 계획이다. 현재 테이블 구조는 [데이터베이스](database.md), 계산·보호 규칙은 [드랍 판매](drop-sales.md)를 참고한다.

## DB 모델의 기본 관계

| 테이블 | 저장할 핵심 데이터 |
| --- | --- |
| characters | 내부 ID, 선택적 ocid, 현재 이름·월드·직업·레벨 |
| boss_presets | 캐릭터, 보스 ID, 난이도, 평소 파티 인원 |
| boss_runs | 캐릭터·보스·기간 키, 완료 출처, 기록 당시 월드·난이도 |
| crystal_settlements | 보스 기록, 판매일, 실제 수령액, 적용 가격·파티 인원 스냅샷 |
| hunting_sessions | 캐릭터, 활동일, 소요 분, 직접 획득 메소, 소모 비용, 메모 |
| drop_lots | 획득 출처, 아이템, 획득 수량, 기록 당시 예상 단가 |
| drop_sales | 판매일, 전체 판매가, 수수료, 실제 내 몫 |
| drop_sale_allocations | 판매와 획득 묶음 연결, 판매한 수량 |
| ledger_entries | 수령·지출일, 캐릭터, 기록 당시 월드, 분류, 금액, 원본 참조 |
| sync_states | 캐릭터·연동 종류별 조회 시각, 기준일, 성공 여부 |
| settings | 민감하지 않은 앱 설정 |

순수익 집계의 원본은 ledger_entries다. 활동 테이블의 메소를 다시 더하지 않는다. 사냥 회차 수정·삭제 시 연결 거래도 동일 트랜잭션에서 수정·삭제한다. 판매 이력이 있는 획득 수량을 임의로 줄이거나 삭제하지 못하게 하고, 판매 정정 또는 취소를 먼저 처리한다.

보스 기록은 캐릭터·안정적인 보스 ID·기간 키로 중복을 막고, 난이도는 기록의 속성으로 둔다. 실제 보스별 중복 처치·보상 규칙은 게임 규칙 확인 후 보상 단위를 세분화한다. 동기화가 기존 사용자 정산을 수정하지 않도록 완료 상태와 정산 테이블을 분리한다.

메소는 SQLite INTEGER로 저장한다. JS에서 처리할 입력·합계·곱셈은 Number.isSafeInteger 범위를 검증하고, 비율 계산의 내림 규칙은 money.ts에서 통일한다. 범위를 넘는 데이터를 조용히 반올림하지 않는다. 활동일과 수령일은 KST YYYY-MM-DD, 시스템 생성·갱신 시각은 UTC 타임스탬프로 저장한다.

## Tailwind 사용 계획

renderer 빌드에만 @tailwindcss/vite 플러그인을 등록한다. styles/index.css에서 Tailwind와 theme.css를 가져온다. Tailwind v4의 CSS 기반 @theme으로 색상·폰트 토큰을 정의하고, 이 계획에서는 tailwind.config.js를 기본 파일로 만들지 않는다.

Button·Input·Dialog 같은 공통 컴포넌트는 Tailwind 클래스로 작성한다. 색상은 기본 배경, 카드 배경, 강조색, 수입, 지출, 미확정 값으로 통일한다. 상태는 색상과 함께 텍스트로 표시한다. 메소 표시는 tabular-nums를 적용하고 입력과 표는 키보드로 조작할 수 있게 한다.

동적 클래스는 문자열 조립 대신 명시적인 클래스 맵을 사용한다. 초기에 디자인 시스템 전체를 만들지 않고, 실제 화면에서 반복되는 요소부터 공통 컴포넌트로 분리한다.

## 저장 위치와 백업

런타임 DB는 Electron app.getPath('userData') 아래 data/maple-roster.sqlite에 저장한다. 안전하게 암호화한 API 키도 userData 내 별도 파일에 보관한다. bootstrap이 이 경로와 SecretStore 구현을 backend에 전달한다. 소스 폴더나 Git 저장소에 실사용 데이터와 키를 저장하지 않는다.

백업 JSON에는 schemaVersion과 기록을 포함하고 키는 제외한다. 복원 전에 스키마·참조 관계·금액·수량을 검증하고 기존 데이터의 백업을 만든다. 장부 복원은 전체 교체만 지원하고 확인 화면을 거친다. 원자적으로 적용해 실패 시 기존 장부를 보존한다. 실행 중 DB 파일 단순 복사 대신 DB 드라이버의 일관된 백업 기능이나 논리적 JSON 내보내기를 사용한다.

현재 JSON 백업·복원은 `backend/modules/backup`, `desktop/main/ipc/backup.handlers.ts`, `frontend/features/settings/BackupManager.tsx`에 구현했다. 메모리 DB의 제약과 업무 정산 검증을 통과한 파일만 확인 토큰을 발급한다. 장부 변경·진행 중 IPC 요청을 확인하고 복원 전 안전 백업을 저장한 뒤 전체 교체한다. 자세한 지원 형식과 흐름은 [백업과 복원](backup.md)에 정리했다.

## 구현 단계

1. Electron + React + Tailwind 기본 실행과 AppLayout. 임시 데이터로 메뉴와 표를 만든다.
2. characters 수동 등록을 shared → desktop → backend → frontend 순서로 연결한다. 재실행 후 유지되는지 확인한다.
3. hunting 회차 저장으로 DB 트랜잭션과 수입·지출 집계를 구현한다.
4. bosses 프리셋·기간 기록·결정석 판매를 구현한다.
5. drops와 ledger를 연결해 일부 판매와 분배·수수료 정산을 구현한다.
6. 개인 키 보관과 NEXON 프로필·완료 상태 연동을 추가한다.
7. dashboard·백업·CSV·Windows 패키징을 완료한다.

단계마다 타입 검사와 빌드를 통과시킨다. 계산 경계, 월 경계 주차, 수량을 초과한 판매, 반복 동기화, 거래 중간 실패의 롤백을 테스트한다. 화면 수동 확인은 실제 입력·정정·재실행·복원 시나리오로 진행한다. 기본 골격 단계에서는 타입 검사·빌드·포맷 검사와 실제 Electron에서 여섯 화면 이동·앱 정보 IPC·renderer 격리 설정을 확인했다.

## 공식 참고 문서

- Electron 프로세스: https://www.electronjs.org/docs/latest/tutorial/process-model
- Electron IPC: https://www.electronjs.org/docs/latest/tutorial/ipc
- Tailwind Vite 설정: https://tailwindcss.com/docs/installation/using-vite
- electron-vite: https://electron-vite.org/guide/
- Node.js 내장 SQLite: https://nodejs.org/api/sqlite.html
- Vitest: https://vitest.dev/guide/
