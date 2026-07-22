/**
 * Thrown when construction options or synced properties violate the renderer's
 * contract.
 *
 * @remarks
 * Extends `TypeError`: it reports a caller mistake — `resources` together with
 * `sdfSize`, an out-of-range `sdfSize` or `opacity`, an inverted `clipRect`, an
 * unparseable color, a malformed layout, or a font key the registry does not
 * cover.
 *
 * Raised synchronously from the constructor, but surfaced as a **rejection**
 * from {@link Text.sync}, since validation of mutable properties happens there.
 * When a font's own call fails, the original error is attached as `cause`.
 */
export class InvalidTextInputError extends TypeError {
  override readonly name = 'InvalidTextInputError'
}

/**
 * Thrown when a {@link Text} is used after disposal.
 *
 * @remarks
 * Delivered as a rejection from {@link Text.sync}. It also surfaces when an
 * in-flight sync is superseded by a newer one or by disposal before its work
 * commits — so seeing it does not necessarily mean the object was disposed, only
 * that this particular update will not be applied.
 */
export class DisposedTextError extends Error {
  override readonly name = 'DisposedTextError'

  constructor() {
    super('Text has been disposed')
  }
}

/**
 * Thrown when {@link TextResources} are used after disposal.
 *
 * @remarks
 * Usually means a shared owner was disposed while a borrowing {@link Text} was
 * still alive, or that a new `Text` was constructed against already-disposed
 * resources. Dispose borrowers before their owner.
 */
export class DisposedTextResourcesError extends Error {
  override readonly name = 'DisposedTextResourcesError'

  constructor() {
    super('TextResources has been disposed')
  }
}
