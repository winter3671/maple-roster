# Windows 설치 파일

Windows x64용 NSIS 설치 파일을 electron-builder로 생성합니다. 현재는 개인용 무서명 빌드이며 Electron 기본 아이콘을 사용합니다. v0.2.0부터 설정에서 GitHub Releases 기반 업데이트 확인·다운로드·재시작 적용을 지원합니다. 배포 절차는 [앱 업데이트](app-updates.md)를 참고하세요.

## 만들기

프로젝트 폴더에서 실행합니다. 의존성을 아직 설치하지 않았다면 먼저 `npm ci`를 실행하세요.

```bash
# 타입 검사·빌드 후 Windows x64 설치 파일 생성
npm run dist:win

# 설치 파일 없이 실행 폴더만 생성
npm run package:win
```

첫 실행에서는 Electron과 NSIS 도구 다운로드를 위해 인터넷 연결이 필요합니다. 별도 SQLite 드라이버나 Visual Studio 빌드 도구는 필요하지 않습니다. 생성 과정에서 서버로 파일을 게시하지 않습니다.

| 결과                     | 위치                                       |
| ------------------------ | ------------------------------------------ |
| 설치 파일                | `release/Maple-Roster-Setup-0.2.1-x64.exe` |
| 설치 전 확인용 실행 파일 | `release/win-unpacked/Maple Roster.exe`    |

설치 파일 이름은 `package.json`의 버전에 따라 바뀝니다. 실행 폴더를 다른 곳으로 옮길 때는 EXE만 복사하지 말고 `win-unpacked` 전체를 옮겨야 합니다. `release`는 Git에서 제외합니다.

## 설치와 기존 장부

설치 파일을 실행하면 현재 Windows 사용자용으로 설치합니다. 설치 위치를 선택할 수 있고 바탕 화면과 시작 메뉴에 바로가기를 만듭니다. 설치가 끝난 뒤 바로가기로 앱을 실행하세요. Node.js나 npm이 설치되지 않은 PC에서도 사용할 수 있습니다.

개발 버전과 설치 버전은 `%APPDATA%/maple-roster`를 같은 데이터 폴더로 사용합니다. 기존 개발 장부를 이어서 사용할 수 있으며, 앱을 동시에 실행하면 이미 열린 창으로 이동합니다. 버전 변경 시에도 저장 경로는 유지합니다.

| 데이터            | 경로                                               |
| ----------------- | -------------------------------------------------- |
| 장부 DB           | `%APPDATA%/maple-roster/data/maple-roster.sqlite`  |
| 암호화 API 키     | `%APPDATA%/maple-roster/secrets/nexon-api-key.bin` |
| 복원 전 안전 백업 | `%APPDATA%/maple-roster/backups`                   |

설치 파일에는 빌드 결과와 필요한 실행 의존성만 포함합니다. 개발용 `.env`, 실제 DB와 API 키는 포함하지 않습니다. 설치 버전은 개발용 `.env`를 읽지 않으므로 `.env`만 사용했다면 **설정 → 넥슨 API 연결**에서 키를 저장하세요. 앱 설정에 이미 저장한 키는 같은 PC·Windows 계정에서 이어서 사용합니다.

앱 제거 시 장부와 키 보관 폴더를 삭제하지 않도록 설정했습니다. 새 버전 설치 전에는 앱을 종료하고 JSON 백업을 저장해두세요. 다른 PC로 옮길 때는 JSON 백업을 복원하고 API 키를 다시 입력합니다.

## 확인한 범위와 직접 확인할 항목

패키징된 EXE를 실제 데이터와 분리된 임시 폴더에서 실행해 다음을 확인했습니다.

- 로컬 화면과 preload IPC 로딩
- Electron 내장 SQLite로 캐릭터·사냥 기록 저장과 수익 집계
- 앱 종료·재실행 후 기록 유지
- 개발 서버 주소가 환경에 있더라도 설치 버전은 로컬 화면 사용
- ASAR 안의 실행 진입점과 `.env`·DB·키 파일 제외

설치 파일 생성은 확인했으며 실제 사용자 계정에 설치·제거하는 과정은 자동 실행하지 않았습니다. 직접 설치한 뒤 바로가기 실행, 기존 장부 조회, API 연결 테스트, 기록 저장 후 재실행을 확인하세요. 무서명 설치 파일이므로 Windows에서 게시자 확인 또는 SmartScreen 안내가 나타날 수 있습니다.

설정 기준은 [electron-builder Windows 문서](https://www.electron.build/win/)와 [NSIS 문서](https://www.electron.build/nsis/)입니다. 설치 설정은 `electron-builder.yml`, 빌드 버전과 명령은 `package.json`에서 관리합니다.
