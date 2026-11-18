import { usePreferences } from '../store/preferences-store'
import { message, type MessageKey } from './messages'

export function useI18n() {
  const locale = usePreferences((state) => state.locale)
  return {
    locale,
    t: <Key extends MessageKey>(key: Key) => message(locale, key),
  }
}
