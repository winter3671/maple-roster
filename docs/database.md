# 현재 데이터베이스 구조

SQLite 파일은 Electron `app.getPath('userData')` 아래 `data/maple-roster.sqlite`에 저장한다. 저장 경로는 desktop에서 전달하고, backend는 Electron을 직접 참조하지 않는다. SQLite 드라이버는 Node.js 내장 `node:sqlite`를 사용한다. 현재 Electron에 포함된 Node.js 24에서 실행을 검증했다.

기존 설계의 better-sqlite3는 별도 네이티브 빌드 도구가 필요하여 내장 모듈로 변경했다. DB 모델과 repository·service 분리 방식은 그대로 유지한다.

## 적용된 마이그레이션

`src/backend/database/migrations/001_characters.sql`을 빌드 시 문자열로 포함한다. 실행 시 `schema_migrations`에 적용 이력을 기록하고, 이미 적용한 SQL은 재실행하지 않는다. 마이그레이션 SQL과 적용 이력은 하나의 트랜잭션으로 처리한다. 앱이 지원하는 버전보다 새로운 DB는 열지 않는다.

## characters

| 컬럼 | 타입 | 의미 |
| --- | --- | --- |
| id | TEXT, PK | 내부 UUID, 이름·월드를 수정해도 유지 |
| name | TEXT | 수동 입력 이름, 1~40자 |
| world | TEXT | 수동 입력 월드, 1~40자 |
| identity_key | TEXT, UNIQUE | 이름·월드의 정규화된 중복 검사 키 |
| notes | TEXT | 선택 메모, 최대 500자 |
| is_hidden | INTEGER | 0: 표시, 1: 숨김 |
| created_at | TEXT | UTC 생성 시각 |
| updated_at | TEXT | UTC 최종 수정 시각 |

앱의 입력 길이는 수동 장부를 위한 제한이며, 게임의 캐릭터명 규칙을 그대로 검증하는 것은 아니다. 월드도 수동 입력한다. API 연결 시에는 실제 월드와 프로필을 확인할 예정이다.

이름·월드·메모는 NFC 정규화와 앞뒤 공백 제거를 적용한다. 이름과 월드는 줄바꿈·탭을 허용하지 않는다. 중복 검사 키는 소문자로 변환한 이름·월드 쌍을 JSON으로 표현하며 숨긴 캐릭터도 중복 검사에 포함한다.

## 저장과 삭제 규칙

- 외래 키 검사를 켜고, WAL 모드와 5초 busy timeout을 사용한다.
- SQL은 값을 바인딩한 prepared statement로 실행한다.
- 현재 캐릭터 변경은 단일 SQL 문으로 원자적으로 반영한다.
- 수정은 ID·생성 시각·숨김 상태를 유지한다.
- 숨김은 목록 필터만 변경하고 데이터를 삭제하지 않는다.
- 삭제는 화면에서 확인 후 실행한다. 실제 장부 테이블은 아직 추가하지 않았다.
- 후속 장부 테이블은 캐릭터를 참조하는 외래 키에 ON DELETE RESTRICT를 사용한다. 연결된 기록이 있을 때 삭제 대신 숨김을 안내하는 동작을 통합 테스트로 검증했다.
- 앱을 중복 실행하면 기존 창을 활성화하고 두 번째 인스턴스는 종료한다.

## 호출 흐름

```text
CharacterForm → characters.api → preload → character.handlers
  → CharacterService (입력 검증·중복 검사)
  → CharacterRepository (SQL) → SQLite
```

IPC 오류는 타입이 있는 결과로 반환한다. 검증 오류·중복·없는 캐릭터·연결 기록 오류를 구분하며, DB 내부 오류 상세는 UI에 노출하지 않는다.

## 검증

`npm test`는 별도의 임시 DB를 사용한다. 재연결 후 유지, 중복과 입력 검증, 정정·숨김, SQL 값 바인딩, 삭제 및 외래 키 보호, 마이그레이션 재적용 방지를 확인한다. 실제 Electron에서도 등록·수정·숨김 복원·삭제 취소와 확인·재실행 후 유지 여부를 검증했다.

UI 자동 확인은 `MAPLE_ROSTER_DATA_DIR`로 일반 사용자 데이터와 분리된 저장 경로를 지정하여 수행했다. 일반 실행에서는 기본 앱 데이터 폴더를 사용한다.
