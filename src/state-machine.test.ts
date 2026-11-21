import { describe, expect, it, vi } from "vitest";
import { StateMachine } from "./state-machine.ts";

type Ctx = { calls: string[] };

const create = () => new StateMachine<Ctx>("INITIAL", { calls: [] });
const begin = { type: "BEGIN_OBSERVING" } as const;

describe("StateMachine", () => {
  it("初期状態を持つ", () => {
    const machine = create();
    expect(machine.getState()).toBe("INITIAL");
    expect(machine.is("INITIAL")).toBe(true);
    expect(machine.is("OBSERVING_TWITTER_PAGE")).toBe(false);
  });

  it("dispatch で遷移し、execute に event と context が渡される", () => {
    const context: Ctx = { calls: [] };
    const machine = new StateMachine<Ctx>("INITIAL", context);
    const execute = vi.fn((_event: unknown, ctx: Ctx) => ctx.calls.push("run"));
    machine.addTransition({
      from: "INITIAL",
      event: "BEGIN_OBSERVING",
      to: "OBSERVING_TWITTER_PAGE",
      execute,
    });

    expect(machine.dispatch(begin)).toBe(true);
    expect(machine.getState()).toBe("OBSERVING_TWITTER_PAGE");
    expect(execute).toHaveBeenCalledWith(begin, context);
    expect(context.calls).toEqual(["run"]);
  });

  it("該当する遷移がなければ false を返し、状態も変わらない", () => {
    const machine = create();
    const listener = vi.fn();
    machine.addListener(listener);

    expect(machine.dispatch(begin)).toBe(false);
    expect(machine.getState()).toBe("INITIAL");
    expect(listener).toHaveBeenCalledWith(expect.objectContaining({ success: false }));
  });

  it("condition が false なら execute を呼ばず、状態も変わらない", () => {
    const machine = create();
    const execute = vi.fn();
    machine.addTransition({
      from: "INITIAL",
      event: "BEGIN_OBSERVING",
      to: "OBSERVING_TWITTER_PAGE",
      condition: () => false,
      execute,
    });
    const listener = vi.fn();
    machine.addListener(listener);

    expect(machine.dispatch(begin)).toBe(false);
    expect(machine.getState()).toBe("INITIAL");
    expect(execute).not.toHaveBeenCalled();
    expect(listener).toHaveBeenCalledWith(expect.objectContaining({ success: false }));
  });

  it("同じ from / event の遷移は先に登録したものだけが使われる（condition が false でも次に進まない）", () => {
    const machine = create();
    machine.addTransitions([
      {
        from: "INITIAL",
        event: "BEGIN_OBSERVING",
        to: "LOADING_SEARCH_PAGE",
        condition: () => false,
      },
      { from: "INITIAL", event: "BEGIN_OBSERVING", to: "LOADING_COMPOSE_PAGE" },
    ]);

    expect(machine.dispatch(begin)).toBe(false);
    expect(machine.getState()).toBe("INITIAL");
  });

  it("canTransition / canHandle は状態を変えずに判定する", () => {
    const machine = create();
    machine.addTransition({
      from: "INITIAL",
      event: "BEGIN_OBSERVING",
      to: "OBSERVING_TWITTER_PAGE",
      condition: () => false,
    });

    expect(machine.canHandle("BEGIN_OBSERVING")).toBe(true);
    expect(machine.canHandle("PAGE_CHANGED")).toBe(false);
    expect(machine.canTransition(begin)).toBe(false);
    expect(machine.getState()).toBe("INITIAL");
  });

  it("tryDispatch は遷移できるときだけ遷移し、結果を返す", () => {
    const machine = create();
    let allowed = false;
    machine.addTransition({
      from: "INITIAL",
      event: "BEGIN_OBSERVING",
      to: "OBSERVING_TWITTER_PAGE",
      condition: () => allowed,
    });
    const listener = vi.fn();
    machine.addListener(listener);

    expect(machine.tryDispatch(begin)).toBe(false);
    expect(listener).not.toHaveBeenCalled(); // 失敗してもログ通知しない

    allowed = true;
    expect(machine.tryDispatch(begin)).toBe(true);
    expect(machine.getState()).toBe("OBSERVING_TWITTER_PAGE");
  });

  it("リスナーは遷移成功を受け取り、解除できる", () => {
    const machine = create().addTransition({
      from: "INITIAL",
      event: "BEGIN_OBSERVING",
      to: "OBSERVING_TWITTER_PAGE",
    });
    const listener = vi.fn();
    const unsubscribe = machine.addListener(listener);

    machine.dispatch(begin);
    expect(listener).toHaveBeenCalledWith({
      success: true,
      from: "INITIAL",
      to: "OBSERVING_TWITTER_PAGE",
      event: begin,
    });

    unsubscribe();
    machine.dispatch(begin); // 遷移先に遷移がないので失敗するが、通知はない
    expect(listener).toHaveBeenCalledTimes(1);
  });

  it("removeListener / clearListeners で通知が止まる", () => {
    const machine = create();
    const a = vi.fn();
    const b = vi.fn();
    machine.addListener(a);
    machine.addListener(b);

    machine.removeListener(a);
    machine.dispatch(begin);
    expect(a).not.toHaveBeenCalled();
    expect(b).toHaveBeenCalledTimes(1);

    machine.clearListeners();
    machine.dispatch(begin);
    expect(b).toHaveBeenCalledTimes(1);
  });
});
