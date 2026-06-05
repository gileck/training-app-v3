/**
 * ChatComposer — the shared agent/chat message composer.
 *
 * A single, prop-driven input card that bundles everything a chat
 * surface needs:
 *   - auto-growing textarea (Enter to send, Shift+Enter for newline)
 *   - file attach via the paperclip button AND paste (images/files)
 *   - attachment thumbnail strip (driven by the parent's upload state)
 *   - an optional built-in model picker
 *   - a send button that flips to a Stop button while the agent runs
 *
 * This lives in the synced template layer so every child project's
 * agent reuses the exact same input behaviour. The parent owns the
 * data (upload mutation, model list/value, send/cancel handlers); this
 * component is presentational + interaction only.
 *
 * Branding (welcome copy, suggested prompts, page chrome) belongs in
 * the route that renders this — keep it out of here.
 */

import {
    forwardRef,
    useImperativeHandle,
    useState,
    useRef,
    useEffect,
    FormEvent,
    KeyboardEvent,
    ChangeEvent,
    ClipboardEvent,
    ReactNode,
} from 'react';
import { ArrowUp, Loader2, Square, Paperclip } from 'lucide-react';
import { Button } from '@/client/components/template/ui/button';
import { Textarea } from '@/client/components/template/ui/textarea';
import {
    Select,
    SelectContent,
    SelectGroup,
    SelectItem,
    SelectLabel,
    SelectTrigger,
    SelectValue,
} from '@/client/components/template/ui/select';
import {
    AttachmentChip,
    type AttachmentSlot,
} from '@/client/components/template/chat/AttachmentChip';

// Re-export so callers can import the slot type alongside the composer.
export type { AttachmentSlot } from '@/client/components/template/chat/AttachmentChip';

/** One group in the built-in model picker (e.g. a provider/tier). */
export interface ChatComposerModelGroup {
    label: string;
    models: { id: string; name: string }[];
}

export interface ChatComposerProps {
    onSubmit: (text: string) => void;
    onCancel?: () => void;
    /** Attachments to display as chips. The parent uploads them and
     *  feeds back state updates. */
    attachments?: AttachmentSlot[];
    onAddFiles?: (files: File[]) => void;
    onRemoveAttachment?: (id: string) => void;
    /** Built-in model picker. Provide grouped models + the selected id
     *  + a change handler to render it in the toolbar. Omit to hide. */
    models?: ChatComposerModelGroup[];
    selectedModelId?: string;
    onSelectModel?: (id: string) => void;
    modelPlaceholder?: string;
    /** Extra control rendered in the toolbar after the model picker. */
    toolbarLeftSlot?: ReactNode;
    /** Textarea placeholder. */
    placeholder?: string;
    /** `accept` attribute for the file input. */
    acceptedFileTypes?: string;
    /** True while the user's own send request is still in flight (the
     *  initial POST). Disables the input and shows a spinner. */
    isSending?: boolean;
    /** True while the agent's run is still in flight (visible to all
     *  clients via DB polling). Swaps the Send button for a Stop
     *  button — the input stays enabled so the user can queue the next
     *  message immediately. */
    isAgentRunning?: boolean;
    disabled?: boolean;
}

/** Imperative handle so a parent (e.g. an Edit button on a prior
 *  message) can prefill + focus the textarea without lifting state. */
export interface ChatComposerHandle {
    setText: (text: string) => void;
    focus: () => void;
}

const MAX_TEXTAREA_HEIGHT_PX = 240;
const DEFAULT_ACCEPTED_TYPES =
    'image/*,application/pdf,text/*,.md,.json,.csv,.log';

export const ChatComposer = forwardRef<ChatComposerHandle, ChatComposerProps>(
    function ChatComposer(
        {
            onSubmit,
            onCancel,
            attachments = [],
            onAddFiles,
            onRemoveAttachment,
            models,
            selectedModelId,
            onSelectModel,
            modelPlaceholder = 'Select model',
            toolbarLeftSlot,
            placeholder = 'Message the agent…',
            acceptedFileTypes = DEFAULT_ACCEPTED_TYPES,
            disabled,
            isSending,
            isAgentRunning,
        },
        ref
    ) {
        // eslint-disable-next-line state-management/prefer-state-architecture -- text input before submission
        const [value, setValue] = useState('');
        const textareaRef = useRef<HTMLTextAreaElement>(null);
        const fileInputRef = useRef<HTMLInputElement>(null);

        useImperativeHandle(
            ref,
            () => ({
                setText: (text) => {
                    setValue(text);
                    requestAnimationFrame(() => {
                        const el = textareaRef.current;
                        if (!el) return;
                        el.focus();
                        el.setSelectionRange(text.length, text.length);
                    });
                },
                focus: () => textareaRef.current?.focus(),
            }),
            []
        );

        useEffect(() => {
            const el = textareaRef.current;
            if (!el) return;
            el.style.height = 'auto';
            el.style.height = `${Math.min(el.scrollHeight, MAX_TEXTAREA_HEIGHT_PX)}px`;
        }, [value]);

        const submit = (e?: FormEvent) => {
            e?.preventDefault();
            const trimmed = value.trim();
            // Don't allow submit while any attachment is still uploading
            // — the server-side send would race against an unfinished
            // upload. Require either text or at least one uploaded file.
            const hasUploading = attachments.some(
                (a) => a.status === 'uploading'
            );
            const hasUploaded = attachments.some(
                (a) => a.status === 'uploaded'
            );
            if (hasUploading || disabled || isSending) return;
            if (!trimmed && !hasUploaded) return;
            onSubmit(trimmed);
            setValue('');
        };

        const handleKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
            if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                submit();
            }
        };

        const handleFilesPicked = (e: ChangeEvent<HTMLInputElement>) => {
            const files = Array.from(e.target.files ?? []);
            if (files.length > 0) onAddFiles?.(files);
            // Reset so picking the same filename twice still fires onChange.
            e.target.value = '';
        };

        const handlePaste = (e: ClipboardEvent<HTMLTextAreaElement>) => {
            if (!onAddFiles) return;
            const items = e.clipboardData?.items;
            if (!items || items.length === 0) return;

            const files: File[] = [];
            let hasTextItem = false;
            for (let i = 0; i < items.length; i++) {
                const item = items[i];
                if (item.kind === 'file') {
                    const file = item.getAsFile();
                    if (file) files.push(file);
                } else if (item.kind === 'string') {
                    hasTextItem = true;
                }
            }

            if (files.length === 0) return; // plain-text paste — let it through

            onAddFiles(files);
            // If the clipboard had ONLY file items (e.g. a screenshot),
            // suppress the default — otherwise some browsers paste a
            // placeholder string. Mixed clipboards keep their text part.
            if (!hasTextItem) e.preventDefault();
        };

        const showStop = isAgentRunning && !!onCancel;
        const anyUploading = attachments.some((a) => a.status === 'uploading');
        const hasUsableContent =
            value.trim().length > 0 ||
            attachments.some((a) => a.status === 'uploaded');
        const sendDisabled =
            disabled || isSending || anyUploading || !hasUsableContent;

        const showModelPicker = !!models && models.length > 0;

        return (
            <form
                onSubmit={submit}
                className="mx-auto w-full max-w-3xl px-3 pb-2 pt-2 sm:px-4"
            >
                {/* Composer card — single rounded container holding
                    attachments + textarea + bottom toolbar. */}
                <div className="group relative flex flex-col rounded-[28px] border border-border bg-card shadow-sm transition-all focus-within:border-primary/40 focus-within:shadow-md">
                    {/* Attachment thumbnail strip */}
                    {attachments.length > 0 && (
                        <div className="flex flex-wrap gap-2 px-4 pt-3">
                            {attachments.map((att) => (
                                <AttachmentChip
                                    key={att.id}
                                    attachment={att}
                                    variant="card"
                                    onRemove={
                                        onRemoveAttachment
                                            ? () => onRemoveAttachment(att.id)
                                            : undefined
                                    }
                                />
                            ))}
                        </div>
                    )}

                    {/* Textarea */}
                    <Textarea
                        ref={textareaRef}
                        placeholder={placeholder}
                        value={value}
                        onChange={(e) => setValue(e.target.value)}
                        onKeyDown={handleKeyDown}
                        onPaste={handlePaste}
                        disabled={disabled}
                        rows={1}
                        className="min-h-12 resize-none border-0 bg-transparent px-5 pt-4 pb-1 text-[15px] leading-relaxed shadow-none placeholder:text-muted-foreground/70 focus-visible:ring-0 focus-visible:ring-offset-0"
                    />

                    {/* Bottom toolbar */}
                    <div className="flex items-center gap-1 px-2.5 pb-2.5 pt-1">
                        <Button
                            type="button"
                            variant="ghost"
                            size="icon"
                            onClick={() => fileInputRef.current?.click()}
                            disabled={disabled || !onAddFiles}
                            className="h-9 w-9 shrink-0 rounded-full text-muted-foreground hover:text-foreground"
                            aria-label="Attach file"
                            title="Attach file or paste an image"
                        >
                            <Paperclip className="h-[18px] w-[18px]" />
                        </Button>
                        <input
                            ref={fileInputRef}
                            type="file"
                            multiple
                            accept={acceptedFileTypes}
                            className="hidden"
                            onChange={handleFilesPicked}
                        />

                        <div className="flex min-w-0 flex-1 items-center gap-1">
                            {showModelPicker && (
                                <Select
                                    value={selectedModelId}
                                    onValueChange={(v) => onSelectModel?.(v)}
                                    disabled={disabled}
                                >
                                    <SelectTrigger className="h-8 w-auto min-w-[140px] gap-1.5 rounded-full border-0 bg-transparent px-2.5 text-xs font-medium text-muted-foreground hover:bg-muted hover:text-foreground focus:ring-0">
                                        <SelectValue placeholder={modelPlaceholder} />
                                    </SelectTrigger>
                                    <SelectContent align="start">
                                        {models!.map((group) => (
                                            <SelectGroup key={group.label}>
                                                <SelectLabel>
                                                    {group.label}
                                                </SelectLabel>
                                                {group.models.map((m) => (
                                                    <SelectItem
                                                        key={m.id}
                                                        value={m.id}
                                                    >
                                                        {m.name}
                                                    </SelectItem>
                                                ))}
                                            </SelectGroup>
                                        ))}
                                    </SelectContent>
                                </Select>
                            )}
                            {toolbarLeftSlot}
                        </div>

                        {showStop ? (
                            <Button
                                type="button"
                                size="icon"
                                variant="destructive"
                                onClick={onCancel}
                                className="h-9 w-9 shrink-0 rounded-full"
                                aria-label="Stop agent"
                                title="Stop agent"
                            >
                                <Square className="h-3.5 w-3.5 fill-current" />
                            </Button>
                        ) : (
                            <Button
                                type="submit"
                                size="icon"
                                disabled={sendDisabled}
                                className="h-9 w-9 shrink-0 rounded-full"
                                aria-label="Send message"
                                title="Send message  (Enter)"
                            >
                                {isSending || anyUploading ? (
                                    <Loader2 className="h-4 w-4 animate-spin" />
                                ) : (
                                    <ArrowUp
                                        className="h-[18px] w-[18px]"
                                        strokeWidth={2.5}
                                    />
                                )}
                            </Button>
                        )}
                    </div>
                </div>
            </form>
        );
    }
);
