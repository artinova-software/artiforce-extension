import { KeyDefinition, StateDefinition } from "../platform/state/state-definition";
import { cartStateSchema, EMPTY_CART } from "./models/cart-item";

export const CART_STATE = new StateDefinition("cart", "disk");

/** `global_cart_state` in storage.local. Read by the popup, written by the background. */
export const CART_KEY = new KeyDefinition(CART_STATE, "state", {
  schema: cartStateSchema,
  defaultValue: EMPTY_CART,
});
