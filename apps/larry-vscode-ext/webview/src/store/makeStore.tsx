/* JSX */
/* @jsxImportSource preact */
import { useContext, useReducer } from 'preact/hooks';
import { createContext } from 'preact';

export type DispatchType<A> = (action: A) => void;
export type ReducerType<S, A> = (state: S, action: A) => S;
type PropsType<S> = {
  children?: any;
  initialState?: Partial<S>;
};

export function makeStore<S, A>(initialState: S, reducer: ReducerType<S, A>) {
  const dispatchContext = createContext<DispatchType<A>>((action: A) => {});
  const storeContext = createContext<S>(initialState);

  const StoreProvider = ({
    children,
    initialState: propsInitialState,
  }: PropsType<S>) => {
    const [store, dispatch] = useReducer(reducer, {
      ...initialState,
      ...propsInitialState,
    });

    return (
      <dispatchContext.Provider value={dispatch}>
        <storeContext.Provider value={store}>{children}</storeContext.Provider>
      </dispatchContext.Provider>
    );
  };
  function useDispatch(): DispatchType<A> {
    return useContext(dispatchContext);
  }

  function useStore(): S {
    return useContext(storeContext);
  }

  return [StoreProvider, useDispatch, useStore] as const;
}
