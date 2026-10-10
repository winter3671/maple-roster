import { useState } from 'react'
import { Button } from '../../components/ui/Button'
import { Dialog } from '../../components/ui/Dialog'
import { nexonApi } from './nexon.api'

const steps = [
  {
    title: '넥슨 Open API에 로그인',
    description:
      '아래 공식 가이드 버튼을 눌러 사이트를 열고, 기록을 조회할 캐릭터가 있는 넥슨 계정으로 로그인하세요.'
  },
  {
    title: '애플리케이션 등록',
    description:
      '내 애플리케이션에서 애플리케이션 등록을 선택하고, 게임은 메이플스토리로 설정하세요.'
  },
  {
    title: '타입과 서비스명 입력',
    description:
      '개인 장부에 사용할 키는 개발 단계로 시작할 수 있습니다. 서비스명은 Maple Roster 개인 장부처럼 알아보기 쉽게 입력하고, 약관에 동의한 뒤 등록하세요.'
  },
  {
    title: '발급된 API Key 복사',
    description:
      '내 애플리케이션 목록에서 등록한 애플리케이션의 상세 페이지를 열고 API Key를 복사하세요.'
  },
  {
    title: '이 앱에 계정 등록',
    description:
      '설정으로 돌아와 API 키를 붙여넣고 본계정·부계정 같은 이름을 지정하세요. API 계정 등록 후 현재 계정 연결 확인을 눌러 조회가 되는지 확인할 수 있습니다.'
  }
]

export function NexonKeyGuide({ onClose }: { onClose: () => void }) {
  const [opening, setOpening] = useState(false)
  const [error, setError] = useState('')
  async function openOfficialGuide() {
    if (opening) return
    setOpening(true)
    setError('')
    try {
      await nexonApi.openKeyGuide()
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : '공식 가이드를 열지 못했습니다.')
    } finally {
      setOpening(false)
    }
  }
  return (
    <Dialog title="넥슨 API 키 발급 가이드" onClose={onClose} busy={opening}>
      <p className="text-xs leading-6 text-muted">
        API 키를 연결하면 내 캐릭터 불러오기와 보스·주간 콘텐츠 조회를 사용할 수 있습니다. 키 없이도
        캐릭터와 장부를 직접 기록할 수 있습니다.
      </p>
      <ol className="mt-5 space-y-4">
        {steps.map((step, index) => (
          <li key={step.title} className="flex gap-3">
            <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-brand-soft text-xs font-semibold text-brand">
              {index + 1}
            </span>
            <div>
              <h3 className="text-sm font-semibold">{step.title}</h3>
              <p className="mt-1 text-xs leading-6 text-muted">{step.description}</p>
            </div>
          </li>
        ))}
      </ol>
      <div className="mt-5 rounded-xl bg-canvas p-4 text-xs leading-6 text-muted">
        <p>여러 넥슨 계정을 사용한다면 각 계정으로 로그인해 키를 발급하고 따로 등록하세요.</p>
        <p className="mt-2">
          개발 단계 키는 하루 1,000회 호출 제한이 있습니다. 키를 다른 사람에게 공유하지 마세요.
        </p>
      </div>
      <div className="mt-5 flex flex-wrap gap-2">
        <Button onClick={() => void openOfficialGuide()} disabled={opening}>
          {opening ? '브라우저 여는 중…' : '넥슨 공식 발급 가이드 열기'}
        </Button>
        <Button variant="secondary" onClick={onClose} disabled={opening}>
          닫기
        </Button>
      </div>
      <p className="mt-2 text-[11px] leading-5 text-muted">
        공식 가이드는 기본 브라우저에서 열립니다. 사이트 화면이 달라지면 공식 안내를 참고하세요.
      </p>
      {error && (
        <p role="alert" className="mt-3 text-xs text-expense">
          {error}
        </p>
      )}
    </Dialog>
  )
}
