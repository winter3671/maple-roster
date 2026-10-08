# 넥슨 캐릭터 조회 연동

## 이번 단계의 범위

개발용 `.env` 키로 본인 계정 캐릭터 목록을 조회하고, 선택한 캐릭터의 기본 정보를 확인한 뒤 이름·월드를 장부에 등록한다. 자동 일괄 등록이나 기존 이름·월드·메모 변경은 하지 않는다. OCID 연결, 프로필 영구 저장·동기화, 보스 완료 상태와 safeStorage 기반 키 보관은 다음 단계다.

## 파일과 책임

| 파일 | 책임 |
| --- | --- |
| `backend/config/nexon-key.ts` | 프로젝트 `.env` 읽기, UTF-8 BOM 처리, 키 유무·형식 확인 |
| `backend/integrations/nexon/nexon.client.ts` | 고정 넥슨 URL로 요청, 응답 검증, 오류 변환, 요청 순서와 간격 제어 |
| `backend/modules/nexon/nexon.service.ts` | 키 없는 상태 정보와 조회 기능, API에서 확인한 이름·월드로 등록 |
| `desktop/main/ipc/nexon.handlers.ts` | 지정 창의 main frame 요청만 처리 |
| `shared/contracts/nexon.contract.ts` | 화면에 제공하는 DTO와 OCID 입력 검증 |
| `frontend/features/nexon/` | 연결 테스트, 캐릭터 검색·선택·등록 UI |

## 키 취급

- 개발과 `npm start` 미리보기에서는 `app.getAppPath()` 아래 `.env`를 읽는다.
- 환경 파일의 다른 변수는 전역 환경에 적용하지 않는다. 키를 읽지 못해도 수동 장부는 실행한다.
- `.env`는 평문 로컬 개발 파일이며 `.gitignore`로 제외한다. 키를 바꾸면 앱과 개발 서버를 재시작한다.
- main 프로세스에서만 키를 보유하며 IPC 상태 응답은 `configured`, `issue`만 반환한다.
- 인증은 공식 `x-nxopen-api-key` 헤더를 사용한다. URL·renderer·DB·로그·빌드에 키를 넣지 않는다.
- API 실패 시 원본 응답 메시지와 네트워크 예외 상세를 반환하거나 기록하지 않는다.
- 패키징한 앱은 개발용 `.env`를 읽지 않는다. 배포용 키 입력·암호화 저장은 별도로 구현한다.

## 요청과 저장

`GET https://open.api.nexon.com/maplestory/v1/character/list`의 계정별 목록을 펼쳐 OCID로 중복을 제거하고 레벨순으로 표시한다. 계정 식별자는 화면에 전달하지 않는다. 캐릭터 선택과 등록에는 `GET /maplestory/v1/character/basic?ocid=...`을 사용하며, 날짜를 생략해 API가 제공하는 최신 정보를 조회한다.

등록 시에는 renderer가 보낸 이름·월드를 사용하지 않고 OCID로 서버에서 기본 정보를 다시 확인한다. 같은 이름·월드가 있으면 기존 캐릭터를 반환하고, 없으면 현재 수동 등록 서비스로 추가한다. 기존 캐릭터의 ID·메모·숨김 상태·장부 기록을 변경하지 않는다.

목록과 레벨·직업·길드 정보는 메모리에만 유지한다. 자동 동기화가 없으므로 이름·월드 변경은 현재 캐릭터 관리의 수동 수정으로 처리한다. 추후 OCID로 연동할 때에는 기존 ID를 유지하고, 공식 문서의 30일 이내 API 데이터 갱신 의무를 만족하는 정책을 설계해야 한다.

요청은 클라이언트 단위로 순서대로 실행하고 시작 간격을 300ms 이상 둔다. 요청당 제한 시간은 10초이며 자동 재시도는 하지 않는다. 429 응답 후에는 다음 요청을 최소 5초 늦춘다. 이 간격이 일일 호출량 한도를 보장하는 것은 아니며, 한도 오류는 UI에서 별도로 안내한다. 모든 URL은 고정된 공식 HTTPS 호스트를 사용하고 리다이렉트는 허용하지 않는다.

## 오류 안내

| 오류 | 안내 |
| --- | --- |
| 키 누락·파일 읽기 실패 | 로컬 설정 확인, 수동 장부 사용 가능 |
| OPENAPI00005 / HTTP 401 | 키 유효성과 게임 종류 확인 |
| OPENAPI00002 / HTTP 403 | 본인 계정용 키·조회 권한·정보 활용 동의 확인 |
| OPENAPI00007 / HTTP 429 | 호출량 초과, 잠시 후 재조회 |
| 데이터 준비·점검·기타 API 실패 | 상태 확인 후 재조회 |
| 연결·타임아웃 실패 | 인터넷 연결 확인 |
| 응답 필드 누락·잘못된 타입 | 형식 오류로 처리, 원본 응답 노출 없음 |

## 검증과 출처

Vitest에서는 가짜 키·응답과 임시 SQLite를 사용한다. 키 누락·BOM·따옴표, 인증 헤더와 DTO, OCID 검증, API 오류와 원본 메시지 차단, 요청 순서, 중복 등록과 기존 사냥 기록 보존을 확인한다. 실제 키를 사용하는 네트워크 검증은 별도 임시 DB의 Electron 화면에서 수동으로 수행했으며 실제 키와 캐릭터 이름은 검증 로그에 남기지 않았다. 빌드 산출물에 키 문자열이 없는 것도 확인했다.

- [공식 API 요청 가이드](https://openapi.nexon.com/ko/guide/request-api/)
- [본인 계정 캐릭터 목록 안내](https://openapi.nexon.com/ko/support/notice/2580334/)
- [캐릭터 API 공식 문서](https://openapi.nexon.com/ko/game/maplestory/?id=14)
- [2026-10-08 확인한 공식 명세](references/nexon-character.yaml)

명세 출처: `https://openapi.nexon.com/static/api/maplestory/14_ko_script20260917040003.yaml`
