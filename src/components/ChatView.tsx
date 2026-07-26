import type { Chat, EditingState, ReplyState, Provider, FileAttachment, ImageAttachment } from '../types'
import { MessageList } from './MessageList'
import { ChatInput } from './ChatInput'

interface ChatViewProps {
  chat: Chat | null
  streaming: boolean
  editing: EditingState | null
  replying: ReplyState | null
  activeCharacter?: { name: string; avatar: string } | null
  providers?: Provider[]
  activeProviderId?: string | null
  currentModel?: string
  ocrLanguage?: string
  sttLanguage?: string
  chats: Chat[]
  onSend: (payload: { content: string; fileAttach?: FileAttachment; imageAttach?: ImageAttachment }) => void
  onStop: () => void
  onOpenSidebar: () => void
  onEditMessage: (messageId: string, chatId: string, content: string) => void
  onCancelEdit: () => void
  onSubmitEdit: (content: string) => void
  onCycleVersion: (chatId: string, messageId: string, direction: 'prev' | 'next') => void
  onRegenerate: (chatId: string, messageId: string) => void
  onReply: (messageId: string, chatId: string, preview: string) => void
  onCancelReply: () => void
  onToggleFavorite?: (chatId: string, messageId: string) => void
  onSwitchProvider?: (id: string) => void
  onSwitchModel?: (model: string) => void
}

export function ChatView({
  chat,
  chats,
  streaming,
  editing,
  replying,
  activeCharacter,
  providers,
  activeProviderId,
  currentModel,
  onSend,
  onStop,
  onOpenSidebar,
  onEditMessage,
  onCancelEdit,
  onSubmitEdit,
  onCycleVersion,
  onRegenerate,
  onReply,
  onCancelReply,
  onToggleFavorite,
  onSwitchProvider,
  onSwitchModel,
  ocrLanguage,
  sttLanguage,
}: ChatViewProps) {
  return (
    <main class="chat-view">
      <header class="chat-view__header">
        <button class="btn btn--ghost btn--icon" onClick={onOpenSidebar} title="Open sidebar">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="20" height="20">
            <line x1="3" y1="6" x2="21" y2="6" />
            <line x1="3" y1="12" x2="21" y2="12" />
            <line x1="3" y1="18" x2="21" y2="18" />
          </svg>
        </button>
        {chat && <span class="chat-view__title">{chat.title}</span>}
        {activeCharacter && (
          <div class="chat-view__character-badge" title={`Chatting as ${activeCharacter.name}`}>
            <span class="chat-view__character-avatar">{activeCharacter.avatar}</span>
            <span class="chat-view__character-name">{activeCharacter.name}</span>
          </div>
        )}
        {chat && (
          <span class="chat-view__model">{chat.model}</span>
        )}
      </header>

      <MessageList
        messages={chat?.messages ?? []}
        chatId={chat?.id}
        chatTitle={chat?.title}
        onEdit={(msgId, content) => onEditMessage(msgId, chat!.id, content)}
        onCycleVersion={onCycleVersion}
        onRegenerate={onRegenerate}
        onReply={onReply}
        onToggleFavorite={onToggleFavorite}
        onSuggestionClick={(text) => onSend({ content: text })}
      />

      <ChatInput
        chatId={chat?.id}
        onSend={onSend}
        onStop={onStop}
        streaming={streaming}
        disabled={!chat}
        editing={editing ? { messageId: editing.messageId, initialContent: editing.initialContent } : null}
        onCancelEdit={onCancelEdit}
        onSubmitEdit={onSubmitEdit}
        replying={replying ? { preview: replying.preview } : null}
        onCancelReply={onCancelReply}
        ocrLanguage={ocrLanguage}
        sttLanguage={sttLanguage}
        providers={providers}
        activeProviderId={activeProviderId}
        currentModel={currentModel}
        onSwitchProvider={onSwitchProvider}
        onSwitchModel={onSwitchModel}
        chats={chats}
      />
    </main>
  )
}
