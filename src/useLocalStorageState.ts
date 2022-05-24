import storage from './storage'
import type { Dispatch, SetStateAction } from 'react'
import { useRef, useMemo, useEffect, useCallback, useSyncExternalStore } from 'react'

export type LocalStorageOptions<T> = {
    defaultValue?: T
    crossSync?: boolean
}

// - `useLocalStorageState()` return type
// - first two values are the same as `useState`
export type LocalStorageState<T> = [
    T,
    Dispatch<SetStateAction<T>>,
    {
        removeItem: () => void
    },
]

export default function useLocalStorageState(
    key: string,
    options?: Omit<LocalStorageOptions<unknown>, 'defaultValue'>,
): LocalStorageState<unknown>
export default function useLocalStorageState<T>(
    key: string,
    options?: Omit<LocalStorageOptions<T | undefined>, 'defaultValue'>,
): LocalStorageState<T | undefined>
export default function useLocalStorageState<T>(
    key: string,
    options?: LocalStorageOptions<T>,
): LocalStorageState<T>
export default function useLocalStorageState<T = undefined>(
    key: string,
    options?: LocalStorageOptions<T | undefined>,
): LocalStorageState<T | undefined> {
    const defaultValue = options?.defaultValue

    // SSR support
    if (typeof window === 'undefined') {
        return [defaultValue, (): void => {}, { removeItem: (): void => {} }]
    }

    // eslint-disable-next-line react-hooks/rules-of-hooks
    return useClientLocalStorageState(key, defaultValue, options?.crossSync)
}

function useClientLocalStorageState<T>(
    key: string,
    defaultValue: T | undefined,
    crossSync: boolean = true,
): LocalStorageState<T | undefined> {
    const initialDefaultValue = useRef(defaultValue).current
    const value = useSyncExternalStore(
        useCallback(
            (onStoreChange) => {
                const onChange = (localKey: string): void => {
                    if (key === localKey) {
                        onStoreChange()
                    }
                }
                storage.onChange(onChange)
                return (): void => {
                    storage.offChange(onChange)
                }
            },
            [key],
        ),

        // eslint-disable-next-line react-hooks/exhaustive-deps
        () => storage.get(key, initialDefaultValue),

        // istanbul ignore next
        () => initialDefaultValue,
    )
    const setState = useCallback(
        (newValue: SetStateAction<T | undefined>): void => {
            const value =
                newValue instanceof Function
                    ? newValue(storage.get(key, initialDefaultValue))
                    : newValue

            storage.set(key, value)
        },
        [key, initialDefaultValue],
    )

    // - syncs change across tabs, windows, iframes
    // - the `storage` event is called only in all tabs, windows, iframe's except the one that
    //   triggered the change
    useEffect(() => {
        if (!crossSync) {
            return undefined
        }

        const onStorage = (e: StorageEvent): void => {
            if (e.storageArea === localStorage && e.key === key) {
                storage.triggerChange(key)
            }
        }

        window.addEventListener('storage', onStorage)

        return (): void => {
            window.removeEventListener('storage', onStorage)
        }
    }, [key, crossSync])

    return useMemo(
        () => [
            value,
            setState,
            {
                removeItem(): void {
                    storage.remove(key)
                },
            },
        ],
        [key, setState, value],
    )
}
