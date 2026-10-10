# 현재 데이터베이스 구조

SQLite 파일은 Electron `app.getPath('userData')` 아래 `data/maple-roster.sqlite`에 저장한다. 저장 경로는 desktop에서 전달하고, backend는 Electron을 직접 참조하지 않는다. SQLite 드라이버는 Node.js 내장 `node:sqlite`를 사용한다. 현재 Electron에 포함된 Node.js 24에서 실행을 검증했다.

기존 설계의 better-sqlite3는 별도 네이티브 빌드 도구가 필요하여 내장 모듈로 변경했다. DB 모델과 repository·service 분리 방식은 그대로 유지한다.

## 적용된 마이그레이션

`001_characters.sql`부터 `015_manual_incomes.sql`까지 빌드 시 문자열로 포함한다. 실행 시 `schema_migrations`에 적용 이력을 기록하고, 이미 적용한 SQL은 재실행하지 않는다. 각 마이그레이션 SQL과 적용 이력은 하나의 트랜잭션으로 처리한다. 앱이 지원하는 버전보다 새로운 DB는 열지 않는다. 기존 DB는 캐릭터·사냥·결정·거래 정보를 유지하면서 15번 버전까지 순서대로 갱신한다.

## characters

| 컬럼         | 타입         | 의미                                 |
| ------------ | ------------ | ------------------------------------ |
| id           | TEXT, PK     | 내부 UUID, 이름·월드를 수정해도 유지 |
| name         | TEXT         | 수동 입력 이름, 1~40자               |
| world        | TEXT         | 수동 입력 월드, 1~40자               |
| identity_key | TEXT, UNIQUE | 이름·월드의 정규화된 중복 검사 키    |
| notes        | TEXT         | 선택 메모, 최대 500자                |
| is_hidden    | INTEGER      | 이전 백업 호환용, 항상 0             |
| created_at   | TEXT         | UTC 생성 시각                        |
| updated_at   | TEXT         | UTC 최종 수정 시각                   |

앱의 입력 길이는 수동 장부를 위한 제한이며, 게임의 캐릭터명 규칙을 그대로 검증하는 것은 아니다. 월드도 수동 입력한다. API 연결 시에는 실제 월드와 프로필을 확인할 예정이다.

이름·월드·메모는 NFC 정규화와 앞뒤 공백 제거를 적용한다. 이름과 월드는 줄바꿈·탭을 허용하지 않는다. 중복 검사 키는 소문자로 변환한 이름·월드 쌍을 JSON으로 표현하며 모든 캐릭터를 중복 검사에 포함한다.

## hunting_sessions

| 컬럼                       | 타입     | 의미                                           |
| -------------------------- | -------- | ---------------------------------------------- |
| id                         | TEXT, PK | 클라이언트 저장 요청 UUID, 반복 요청 중복 방지 |
| character_id               | TEXT, FK | 캐릭터 ID, ON DELETE RESTRICT                  |
| world_snapshot             | TEXT     | 기록 당시 월드                                 |
| activity_date              | TEXT     | 한국 기준 사냥 날짜, YYYY-MM-DD                |
| minutes                    | INTEGER  | 0~1,440분, 0은 시간 미기록                     |
| mesos / cost               | INTEGER  | 직접 획득한 메소 / 소모 비용                   |
| sol_fragments / nodestones | INTEGER  | 솔 에르다 조각 / 코어 젬스톤 수량              |
| notes                      | TEXT     | 최대 500자 회차 메모                           |
| created_at / updated_at    | TEXT     | UTC 생성 / 수정 시각                           |

순수익과 시간당 순수익은 저장된 금액·시간으로 계산한다. 캐릭터 이름은 현재 이름을 표시하고 월드는 기록 당시 값을 보존한다. 같은 캐릭터의 월드를 변경해도 과거 사냥 기록의 월드는 바뀌지 않는다. 회차를 다른 캐릭터로 옮기면 새 캐릭터의 현재 월드를 적용한다.

## ledger_entries

| 컬럼                    | 타입                        | 의미                                   |
| ----------------------- | --------------------------- | -------------------------------------- |
| id                      | TEXT, PK                    | 거래 UUID                              |
| hunting_session_id      | TEXT, FK, NULL 가능         | 사냥 회차 ID, ON DELETE CASCADE        |
| crystal_settlement_id   | TEXT, UNIQUE, FK, NULL 가능 | 결정 정산 ID, ON DELETE CASCADE        |
| drop_sale_id            | TEXT, UNIQUE, FK, NULL 가능 | 드랍 판매 ID, ON DELETE CASCADE        |
| character_id            | TEXT, FK                    | 캐릭터 ID, ON DELETE RESTRICT          |
| world_snapshot          | TEXT                        | 기록 당시 월드                         |
| occurred_on             | TEXT                        | 사냥 거래는 활동일, 결정·드랍은 판매일 |
| direction               | TEXT                        | income 또는 expense                    |
| amount                  | INTEGER                     | 1 이상 정수 메소                       |
| created_at / updated_at | TEXT                        | UTC 생성 / 수정 시각                   |

회차별 수입·지출은 각 하나씩만 생성한다. `(hunting_session_id, direction)`을 UNIQUE로 보호한다. 결정·드랍 판매는 판매당 수입 하나만 생성하고 각 원본 FK를 UNIQUE로 보호한다. 세 원본 FK 중 정확히 하나만 값이 있어야 하며 결정·드랍 거래는 income만 허용한다. 금액 0인 거래는 생성하지 않으며, 수정 후 0이 되면 삭제한다. 0이 아닌 기존 거래의 ID·생성 시각은 수정 시 유지한다. 수동 거래는 후속 단계다.

## drop_lots / drop_sales

- `drop_lots`: 사냥·보스 중 하나의 활동 FK(CASCADE), 캐릭터 FK(RESTRICT), 월드·획득 기준일·파티 인원 스냅샷, 이름, 획득 수량(1~1,000,000), 예상 단가, 메모. 사냥의 조각·젬스톤은 `managed_kind`로 구분하며 `(hunting_session_id, managed_kind)`를 UNIQUE로 보호한다.
- `drop_sales`: 획득 묶음 FK(RESTRICT), 판매일, 판매 수량, 전체 판매대금·수수료, 분배 인원·방식·수동 분배금, 내 실제 몫, 판매 당시 예상 단가 스냅샷과 시각. 서비스 트랜잭션 안에서 판매 수량 합계가 획득 수량을 넘지 않도록 검증한다.

남은 수량·예상 가치·판매 수입은 저장된 판매에서 계산한다. 판매가 있으면 원본 활동 삭제를 막고 판매 취소를 안내한다. 4번 마이그레이션은 기존 조각·젬스톤 수량을 재고로 생성하고 장부를 확장하면서 기존 거래를 그대로 복사한다. 자세한 규칙은 [드랍 판매](drop-sales.md)를 참고한다.

## boss_presets / boss_runs / crystal_settlements

9번 마이그레이션은 수동 가격 이력을 저장하는 `crystal_price_history` 테이블을 추가한다. 보스·난이도·적용일은 UNIQUE이며 양의 정수 가격, 확인일과 출처를 저장한다. 기본 가격표는 앱에 포함하고 수동 이력만 DB·JSON 백업에서 관리한다. 가격표 저장·삭제는 기존 보스 기록이나 정산을 갱신하지 않는다. 상세 규칙은 [결정 가격 이력](crystal-price-history.md)을 참고한다.

8번 마이그레이션은 `boss_runs`에 `party_size_needs_review`(0 또는 1)를 추가한다. API 자동 추가나 난이도 변경으로 인원을 추정한 기록은 1로 저장하고, 사용자가 인원을 확인하거나 보스·난이도·인원을 변경해 저장하면 0으로 바꾼다. 메모·날짜만 수정하면 상태를 유지한다. 기존 기록은 기본값 0으로 보존하며 인원과 수익을 바꾸지 않는다.

- `boss_presets`: 캐릭터 FK(RESTRICT), 보스 키·이름, 난이도, 파티 인원(1~6명), 결정 전체 가격과 생성·수정 시각. 캐릭터·보스 키를 UNIQUE로 보호한다.
- `boss_runs`: 캐릭터 FK(RESTRICT), 기록 당시 월드, 보스·난이도·파티 인원·가격 스냅샷, 목요일 기준 `period_start`, 수동 클리어 상태와 메모. 캐릭터·보스 키·주차를 UNIQUE로 보호한다. 프리셋 삭제가 과거 기록을 지우지 않도록 프리셋 FK는 두지 않는다.
- `crystal_settlements`: 보스 기록 FK(CASCADE, UNIQUE), 판매일, 실제 수령액, 생성·수정 시각. 보스 기록당 하나의 정산만 허용하고 0 메소도 판매 상태로 저장한다.

3번 마이그레이션에서 장부 테이블을 확장할 때 기존 사냥 거래의 ID·날짜·금액·생성 시각을 그대로 복사한다. 정산과 장부 변경은 함께 트랜잭션으로 처리한다. 구체적인 동작은 [보스 장부](boss-ledger.md)를 참고한다.

금액은 JavaScript의 안전한 정수 범위까지 허용한다. 합계와 시간당 계산의 중간 연산은 BigInt를 사용하고, 반환값이 안전한 범위를 넘으면 오류로 처리한다. 날짜·캐릭터별 조회를 위해 사냥 날짜와 거래 날짜에 인덱스를 둔다.

## 저장과 삭제 규칙

7번 마이그레이션은 `characters`에 `nexon_ocid`와 프로필 캐시(`nexon_level`, `nexon_job`, `nexon_guild`, `nexon_fetched_at`)를 추가한다. 기존 캐릭터는 API 미연결 상태로 유지하며 장부를 수정하지 않는다. OCID는 NULL을 제외한 UNIQUE 인덱스로 중복 연결을 막는다. 프로필 갱신은 캐릭터의 최신 이름·월드·중복 키와 API 캐시를 원자적으로 갱신하며 메모·생성 시각을 보존한다. 30일 지난 프로필 캐시는 캐릭터 조회 시 제거하고, 연결 해제는 OCID와 캐시를 함께 지운다. 상세 갱신 규칙은 [넥슨 연동](nexon-api.md)을 따른다.

- 외래 키 검사를 켜고, WAL 모드와 5초 busy timeout을 사용한다.
- SQL은 값을 바인딩한 prepared statement로 실행한다.
- 현재 캐릭터 변경은 단일 SQL 문으로 원자적으로 반영한다.
- 수정은 ID·생성 시각를 유지한다.
- 사냥 회차와 연결된 수입·지출은 BEGIN IMMEDIATE 트랜잭션으로 함께 저장·수정·삭제한다. 일부 SQL이 실패하면 전체 변경을 되돌린다.
- 사냥 저장은 요청 UUID로 중복을 막는다. 같은 UUID와 같은 입력으로 재요청하면 기존 기록을 반환하고, 내용이 다르면 충돌 오류를 반환한다.
- 사냥 기록 삭제는 화면에서 확인 후 실행하며 연결된 거래도 함께 삭제한다.
- 캐릭터를 참조하는 외래 키에 ON DELETE RESTRICT를 사용한다. 연결된 기록이 있으면 삭제를 막고 기록 정리를 안내한다. 모든 캐릭터에 새 기록을 추가할 수 있다.
- 앱을 중복 실행하면 기존 창을 활성화하고 두 번째 인스턴스는 종료한다.

## 호출 흐름

```text
CharacterForm → characters.api → preload → character.handlers
  → CharacterService (입력 검증·중복 검사)
  → CharacterRepository (SQL) → SQLite
```

사냥 호출은 `HuntingSessionForm → hunting.api → preload → hunting.handlers → HuntingService → UnitOfWork → HuntingRepository / LedgerRepository → SQLite`로 처리한다. 서비스가 요청 검증·캐릭터 확인을 담당하고 domain 계산 함수가 순수익·시간당 수익을 계산한다.

IPC 오류는 타입이 있는 결과로 반환한다. 검증 오류·중복·없는 캐릭터·없는 회차·요청 충돌·연결 기록 오류를 구분하며, DB 내부 오류 상세는 UI에 노출하지 않는다.

## 검증

`npm test`는 별도의 임시 DB를 사용한다. 캐릭터 관리 외에 사냥 저장·재연결, 중복 요청, 회차 수정과 거래 ID 유지, 기간·캐릭터 필터, 월드 보존, 저장·수정·삭제 도중 오류에 대한 전체 롤백, 캐릭터 삭제 보호, 기존 DB 업그레이드를 확인한다. 수익 계산은 시간 미기록 제외, 총시간에 따른 집계, 음수 내림, 안전한 정수 범위와 KST 날짜 경계도 확인한다.

실제 Electron에서 사냥 등록·수정, 거래 내역과 대시보드 반영, 재실행 후 유지, 삭제 취소·확인을 검증했다.

UI 자동 확인은 `MAPLE_ROSTER_DATA_DIR`로 일반 사용자 데이터와 분리된 저장 경로를 지정하여 수행했다. 일반 실행에서는 기본 앱 데이터 폴더를 사용한다.

## manual_expenses

13번 마이그레이션은 `currency`(meso/maplePoint), `point_amount`, `points_per_100m`을 추가한다. 메소 기록에는 포인트 필드를 NULL로 두고, 포인트 기록은 양의 정수 원본과 환전비를 함께 보관한다. `amount`와 연결 거래 금액은 환산 메소를 사용한다. 기존 지출은 메소로 유지한다. 계산·복원 규칙은 [메이플포인트 지출](expense-maple-points.md)을 참고한다.

10번 마이그레이션은 직접 지출 원본을 저장하는 `manual_expenses`를 추가한다. 캐릭터 FK(RESTRICT), 거래 당시 서버, 지출 날짜, 분류, 양의 정수 금액, 메모와 생성·수정 시각을 보관한다. `ledger_entries`에는 UNIQUE FK `manual_expense_id`(CASCADE)를 추가한다. 사냥·결정·드랍·직접 지출 출처 중 정확히 하나만 연결할 수 있으며 직접 지출의 방향은 expense다.

기존 거래의 ID·금액·날짜·생성·수정 시각을 보존하며 장부 테이블을 확장한다. 직접 지출과 거래의 저장·수정은 한 트랜잭션이며 삭제는 연결 거래도 제거한다. 요청 UUID로 재시도 중복을 막는다. [거래 내역](ledger-view.md)과 [백업](backup.md)에 상세 규칙이 있다.

## 주간 콘텐츠 조회 기록

14번 마이그레이션은 캐릭터 ID·주차를 복합 키로 하는 `weekly_content_snapshots`를 추가한다. OCID, 지하수로·플래그의 필요한 수치만 담은 JSON, 마지막 조회 시각을 저장한다. 캐릭터 삭제는 CASCADE로 함께 정리한다. 이번 주와 지난주만 유지하고 앱 실행·조회 때 오래된 행을 삭제한다. 이전 `is_hidden` 값은 모두 0으로 전환하며 해당 열은 이전 백업 호환용으로만 남긴다. 화면·IPC·캐릭터 계약에서는 제거했다.

## manual_incomes

15번 마이그레이션은 직접 수익 원본을 저장하는 `manual_incomes`를 추가한다. 캐릭터 FK(RESTRICT), 거래 당시 서버, 날짜, 분류, 양의 안전한 정수 금액, 메모와 시각을 보관한다. `ledger_entries`의 UNIQUE FK `manual_income_id`(CASCADE)로 연결하며 방향은 income이다. 다섯 출처 중 정확히 하나만 연결한다. 기존 거래 값과 ID를 보존한다. 저장·수정은 하나의 트랜잭션이며 삭제는 대응 거래도 제거한다.
