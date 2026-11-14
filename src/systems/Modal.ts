export type UiAction = 'up' | 'down' | 'left' | 'right' | 'confirm' | 'back';

/** 打开时会挡住玩家移动的界面（手机、背包、暂停……） */
export interface Modal {
  readonly isOpen: boolean;
  open(): void;
  close(): void;
  handle(action: UiAction): void;
}
