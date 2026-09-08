export interface GameModule {
  readonly eventTypes: readonly string[];
  render(): void;
  handleEvent(event: Event): boolean;
}

export const createGameEventDelegate =
  (modules: readonly GameModule[]) =>
  (event: Event): void => {
    for (const module of modules) {
      if (!module.eventTypes.includes(event.type)) continue;
      if (module.handleEvent(event)) return;
    }

    throw new Error(`No game module handled the ${event.type} event`);
  };
