/**
 * @deprecated Import `ChatComposer` from
 * `@/client/components/template/chat/ChatComposer` instead.
 *
 * The composer now lives in the synced template layer so every child
 * project shares the same input (file attach, paste, model picker,
 * send/stop). This thin re-export keeps older `./MessageInput` imports
 * working — the names map straight onto the shared component.
 */

export {
    ChatComposer as MessageInput,
    type ChatComposerHandle as MessageInputHandle,
    type ChatComposerProps as MessageInputProps,
} from '@/client/components/template/chat/ChatComposer';
export type { AttachmentSlot } from '@/client/components/template/chat/AttachmentChip';
