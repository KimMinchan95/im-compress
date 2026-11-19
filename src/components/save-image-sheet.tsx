import { createPortal } from 'react-dom'
import { useI18n } from '../lib/use-i18n'

export function SaveImageSheet({
  url,
  onClose,
  onDownload,
}: {
  url: string
  onClose: () => void
  onDownload: () => void
}) {
  const { t } = useI18n()

  return createPortal(
    <div className="fixed inset-0 z-50 flex flex-col bg-ink">
      <div className="flex shrink-0 items-center justify-between gap-3 px-4 pt-[max(0.75rem,env(safe-area-inset-top))] pb-3">
        <p className="text-sm leading-5 text-cream">{t('imageSaveHint')}</p>
        <button
          type="button"
          onClick={onClose}
          className="h-10 shrink-0 cursor-pointer rounded-full bg-sunken px-4 text-sm font-semibold ring-1 ring-line"
        >
          {t('close')}
        </button>
      </div>
      <div className="flex min-h-0 flex-1 items-center justify-center px-4">
        <img
          src={url}
          alt={t('altCompressed')}
          className="save-callout max-h-full max-w-full object-contain"
        />
      </div>
      <div className="shrink-0 px-5 pt-3 pb-[max(1rem,env(safe-area-inset-bottom))]">
        <button
          type="button"
          onClick={onDownload}
          className="h-11 w-full cursor-pointer rounded-full bg-accent text-sm font-semibold text-on-accent transition duration-200 active:scale-[0.98]"
        >
          {t('download')}
        </button>
      </div>
    </div>,
    document.body,
  )
}
