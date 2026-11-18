import type { EditorErrorCode } from '../types'
import { message, type Locale } from './messages'

export function errorMessage(locale: Locale, error: EditorErrorCode) {
  if (error === 'unsupported') return message(locale, 'unsupported')
  if (error === 'unreadable') return message(locale, 'unreadable')
  return message(locale, 'encodeFailed')
}
