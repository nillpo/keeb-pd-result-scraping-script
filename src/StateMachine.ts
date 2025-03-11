type StateTemplate<S> = { state: S };
type IdleStateSchema = StateTemplate<"IDLE">;

type LoadingSearchPageSchema = StateTemplate<"LOADING_SEARCH_PAGE">;
type MonitoringSearchPageSchema = StateTemplate<"MONITORING_SEARCH_PAGE">;

type LoadingComposePageSchema = StateTemplate<"LOADING_COMPOSE_PAGE">;
type MonitoringComposePageSchema = StateTemplate<"MONITORING_COMPOSE_PAGE">;

type StateSchema =
  | IdleStateSchema
  | LoadingSearchPageSchema
  | MonitoringSearchPageSchema
  | LoadingComposePageSchema
  | MonitoringComposePageSchema;
type State = StateSchema["state"];
type EventType =
  | "PAGE_CHANGED"
  | "DETECT_SEARCH_URL"
  | "DETECT_COMPOSE_URL"
  | "SEARCH_PAGE_LOADED"
  | "COMPOSE_PAGE_LOADED";
type Event<E extends EventType, T = Record<string | number | symbol, never>> = {
  type: E;
} & T;
type DetectSearchUrlEvent = Event<"DETECT_SEARCH_URL", { url: string }>;
type DetectComposeUrlEvent = Event<"DETECT_COMPOSE_URL", { url: string }>;
type SearchPageLoadedEvent = Event<
  "SEARCH_PAGE_LOADED",
  { css_selector: string }
>;
type ComposePageLoadedEvent = Event<
  "COMPOSE_PAGE_LOADED",
  { css_selector: string }
>;
type PageChangedEvent = Event<"PAGE_CHANGED", { url: string }>;

type Events =
  | DetectComposeUrlEvent
  | DetectSearchUrlEvent
  | SearchPageLoadedEvent
  | ComposePageLoadedEvent
  | PageChangedEvent;

type StateContext = {
  searchTimelineObserver: MutationObserver;
  listeners: number[];
};

export type Transition = {
  from: State;
  to: State;
  event?: EventType;
  condition?: (event: Events) => boolean;
  execute?: (event: Events, context: StateContext) => void;
};

type TransitionResult =
  | { success: true; from: State; to: State; event: Events }
  | { success: false; from: State; event: Events; reason: string };

type Listener = (result: TransitionResult) => void;
export class StateMachine {
  private currentState: State;
  private listeners: Listener[] = [];
  private transitions: Transition[] = [];
  private context: StateContext;

  constructor(initialState: State = "IDLE", context: StateContext) {
    this.currentState = initialState;
    this.context = context;
  }

  public addTransition(transition: Transition): this {
    this.transitions.push(transition);
    return this;
  }

  public addTransitions(transitions: Transition[]): this {
    this.transitions.push(...transitions);
    return this;
  }

  public getState(): State {
    return this.currentState;
  }

  public addListener(listener: Listener): () => void {
    this.listeners.push(listener);
    return () => {
      const index = this.listeners.indexOf(listener);
      if (index !== -1) {
        this.listeners.splice(index, 1);
      }
    };
  }

  public removeListener(listener: Listener): void {
    const index = this.listeners.indexOf(listener);
    if (index !== -1) {
      this.listeners.splice(index, 1);
    }
  }

  public clearListeners(): void {
    this.listeners = [];
  }

  private notifyListeners(result: TransitionResult): void {
    for (const listener of this.listeners) {
      listener(result);
    }
  }

  public canTransition(event: Events): boolean {
    const matchedTransition = this.transitions.find(
      (t) => t.from === this.currentState && t.event === event.type,
    );

    if (!matchedTransition) {
      return false;
    }

    if (matchedTransition.condition) {
      return matchedTransition.condition(event);
    }

    return true;
  }

  public dispatch(event: Events): boolean {
    const prevState = this.currentState;

    const matchedTransition = this.transitions.find(
      (t) => t.from === this.currentState && t.event === event.type,
    );

    if (!matchedTransition) {
      this.notifyListeners({
        event,
        from: prevState,
        reason:
          `No transition found for event ${event.type} in state ${this.currentState}`,
        success: false,
      });
      return false;
    }

    if (
      matchedTransition.condition && !matchedTransition.condition(event)
    ) {
      this.notifyListeners({
        event,
        from: prevState,
        reason:
          `Action for event ${event.type} in state ${this.currentState} failed`,
        success: false,
      });
      return false;
    } else {
      matchedTransition.execute &&
        matchedTransition.execute(event, this.context);
    }

    this.currentState = matchedTransition.to;

    this.notifyListeners({
      event,
      from: prevState,
      to: matchedTransition.to,
      success: true,
    });

    return true;
  }

  public tryDispatch(event: Events): boolean {
    if (this.canTransition(event)) {
      this.dispatch(event);
      return true;
    } else {
      return false;
    }
  }
  public is(state: State): boolean {
    return this.currentState === state;
  }

  public canHandle(eventType: EventType): boolean {
    return this.transitions.some((t) =>
      t.from === this.currentState && t.event === eventType
    );
  }
}
