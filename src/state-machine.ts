import { Tweet } from "./tweet-parser.ts";
type StateTemplate<S> = { state: S };

type InitialStateSchema = StateTemplate<"INITIAL">;
type ObservingTwitterPageSchema = StateTemplate<"OBSERVING_TWITTER_PAGE">;

type LoadingSearchPageSchema = StateTemplate<"LOADING_SEARCH_PAGE">;
type MonitoringSearchPageSchema = StateTemplate<"MONITORING_SEARCH_PAGE">;

type LoadingComposePageSchema = StateTemplate<"LOADING_COMPOSE_PAGE">;
type MonitoringComposePageSchema = StateTemplate<"MONITORING_COMPOSE_PAGE">;

type StateSchema =
  | InitialStateSchema
  | ObservingTwitterPageSchema
  | LoadingSearchPageSchema
  | MonitoringSearchPageSchema
  | LoadingComposePageSchema
  | MonitoringComposePageSchema;
type State = StateSchema["state"];
type StateEventType =
  | "INITIAL"
  | "PAGE_CHANGED"
  | "DETECT_SEARCH_URL"
  | "DETECT_COMPOSE_URL"
  | "SEARCH_PAGE_LOADED"
  | "COMPOSE_PAGE_LOADED"
  | "BEGIN_OBSERVING"
  | "UPDATE_TWEET_CONTEXT";

type StateEventPayload<
  E extends StateEventType,
  T = Record<PropertyKey, unknown>,
> = {
  type: E;
} & T;

type BeginObservingEvent = StateEventPayload<
  "BEGIN_OBSERVING"
>;
type DetectSearchUrlEvent = StateEventPayload<
  "DETECT_SEARCH_URL",
  { url: string }
>;
type DetectComposeUrlEvent = StateEventPayload<
  "DETECT_COMPOSE_URL",
  { url: string }
>;
type SearchPageLoadedEvent = StateEventPayload<
  "SEARCH_PAGE_LOADED",
  { css_selector: string }
>;
type ComposePageLoadedEvent = StateEventPayload<
  "COMPOSE_PAGE_LOADED",
  { css_selector: string }
>;
type PageChangedEvent = StateEventPayload<"PAGE_CHANGED", { url: string }>;
type UpdateTweetContextEvent = StateEventPayload<
  "UPDATE_TWEET_CONTEXT",
  { tweet: Tweet }
>;

type StateEvents =
  | DetectComposeUrlEvent
  | DetectSearchUrlEvent
  | SearchPageLoadedEvent
  | ComposePageLoadedEvent
  | PageChangedEvent
  | BeginObservingEvent
  | UpdateTweetContextEvent;

export type Transition<T> = {
  from: State;
  to: State;
  event?: StateEventType;
  condition?: (event: StateEvents) => boolean;
  execute?: (event: StateEvents, context: T) => void;
};

type TransitionResult =
  | { success: true; from: State; to: State; event: StateEvents }
  | { success: false; from: State; event: StateEvents; reason: string };

type Listener = (result: TransitionResult) => void;

export interface ExecuteHandler<T> {
  (event: StateEvents, context: T): void;
}

export class StateMachine<StateContext extends Record<string, unknown>> {
  private currentState: State;
  private listeners: Listener[] = [];
  private transitions: Transition<StateContext>[] = [];
  private context: StateContext;

  constructor(initialState: State = "INITIAL", context: StateContext) {
    this.currentState = initialState;
    this.context = context;
  }

  public addTransition(transition: Transition<StateContext>): this {
    this.transitions.push(transition);
    return this;
  }

  public addTransitions(transitions: Transition<StateContext>[]): this {
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

  public canTransition(event: StateEvents): boolean {
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

  public dispatch(event: StateEvents): boolean {
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

  public tryDispatch(event: StateEvents): boolean {
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

  public canHandle(eventType: StateEventType): boolean {
    return this.transitions.some((t) =>
      t.from === this.currentState && t.event === eventType
    );
  }
}
