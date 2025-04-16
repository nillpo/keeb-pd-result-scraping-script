import { Tweet } from "./tweet-parser.ts";
type StateTemplate<S> = { state: S };

type IdleStateSchema = StateTemplate<"IDLE">;
type ObservingPageSchema = StateTemplate<"OBSERVING_PAGE">;

type MonitoringSearchSchema = StateTemplate<"MONITORING_SEARCH">;
type MonitoringComposeSchema = StateTemplate<"MONITORING_COMPOSE">;
type MonitoringTweetDetailSchema = StateTemplate<"MONITORING_TWEET_DETAIL">;

type StateSchema =
  | IdleStateSchema
  | ObservingPageSchema
  | MonitoringSearchSchema
  | MonitoringComposeSchema
  | MonitoringTweetDetailSchema;
type State = StateSchema["state"];

type StateEventType =
  | "START"
  | "PAGE_CHANGE" 
  | "SEARCH_PAGE_READY"
  | "COMPOSE_PAGE_READY" 
  | "TWEET_DETAIL_PAGE_READY"
  | "TWEET_CONTEXT_UPDATED"; 

type StateEventPayload<
  E extends StateEventType,
  T = Record<PropertyKey, unknown>,
> = {
  type: E;
} & T;

type StartEvent = StateEventPayload<"START">; 
type SearchPageReadyEvent = StateEventPayload<
  "SEARCH_PAGE_READY",
  { url: string; css_selector: string } 
>;
type ComposePageReadyEvent = StateEventPayload<
  "COMPOSE_PAGE_READY",
  { url: string; css_selector: string } 
>;
type PageChangeEvent = StateEventPayload<"PAGE_CHANGE", { url: string }>;
type TweetContextUpdatedEvent = StateEventPayload<
  "TWEET_CONTEXT_UPDATED",
  { tweet: Tweet } 
>;
type TweetDetailPageReadyEvent = StateEventPayload<
  "TWEET_DETAIL_PAGE_READY",
  { url: string; css_selector: string } 
>;
type StateEvents =
  | SearchPageReadyEvent
  | ComposePageReadyEvent
  | TweetDetailPageReadyEvent
  | PageChangeEvent
  | StartEvent
  | TweetContextUpdatedEvent;

export type Transition<T> = {
  from: State;
  to: State;
  event?: StateEventType;
  condition?: (event: StateEvents, context: T) => boolean;
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

  constructor(initialState: State = "IDLE", context: StateContext) {
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
      return matchedTransition.condition(event, this.context);
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
      matchedTransition.condition &&
      !matchedTransition.condition(event, this.context)
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
