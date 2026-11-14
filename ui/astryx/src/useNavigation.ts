import { useEffect, useRef, useState } from "react";
import { parseRoute, routeHash, type Route } from "./navigation";

export function useNavigation(enabled = true) {
  const [route, setRoute] = useState<Route>(() => parseRoute(location.hash));
  const [pending, setPending] = useState<(() => void) | null>(null);
  const [blocked, setBlocked] = useState(false);
  const current = useRef(route),
    index = useRef(0),
    dirty = useRef(false),
    busy = useRef(false);
  const restoring = useRef(false),
    allowed = useRef(false);
  const guard = (action: () => void) => {
    if (busy.current) {
      setBlocked(true);
      return;
    }
    if (dirty.current) {
      setPending(() => action);
      return;
    }
    action();
  };
  const commit = (next: Route) => {
    current.current = next;
    dirty.current = false;
    busy.current = false;
    setRoute(next);
    setBlocked(false);
  };
  const navigate = (next: Route) => {
    if (routeHash(next) === routeHash(current.current)) return;
    guard(() => {
      history.pushState({ nradioIndex: ++index.current }, "", routeHash(next));
      commit(next);
    });
  };
  useEffect(() => {
    if (!enabled) return;
    history.replaceState({ nradioIndex: 0 }, "", routeHash(current.current));
    const pop = (event: PopStateEvent) => {
      if (restoring.current) {
        restoring.current = false;
        return;
      }
      const next = parseRoute(location.hash),
        target = event.state?.nradioIndex ?? index.current;
      if (!allowed.current && (dirty.current || busy.current)) {
        const delta = target - index.current;
        if (delta) {
          restoring.current = true;
          history.go(-delta);
        } else
          history.replaceState(
            { nradioIndex: index.current },
            "",
            routeHash(current.current),
          );
        guard(() => {
          if (delta) {
            allowed.current = true;
            history.go(delta);
          } else {
            history.pushState(
              { nradioIndex: ++index.current },
              "",
              routeHash(next),
            );
            commit(next);
          }
        });
        return;
      }
      allowed.current = false;
      index.current = target;
      commit(next);
    };
    const unload = (event: BeforeUnloadEvent) => {
      if (dirty.current || busy.current) {
        event.preventDefault();
        event.returnValue = "";
      }
    };
    addEventListener("popstate", pop);
    addEventListener("beforeunload", unload);
    return () => {
      removeEventListener("popstate", pop);
      removeEventListener("beforeunload", unload);
    };
  }, [enabled]);
  return {
    route,
    navigate,
    guard,
    pending,
    blocked,
    setBlocked,
    back: () => {
      if (index.current > 0) history.back();
      else navigate({ tab: route.tab });
    },
    setPageState: (state: { dirty: boolean; busy: boolean }) => {
      dirty.current = state.dirty;
      busy.current = state.busy;
      if (!state.busy) setBlocked(false);
    },
    cancel: () => setPending(null),
    discard: () => {
      const action = pending;
      setPending(null);
      dirty.current = false;
      action?.();
    },
  };
}
