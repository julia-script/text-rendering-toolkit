import { Converter, ReflectionKind } from 'typedoc'

/**
 * Drops members a reflection inherited from a base class it does not own.
 *
 * `Text` extends Three.js `Mesh`, so without this the generated page carries the
 * entire `Object3D` surface — roughly 2900 lines of Three's own documentation
 * ahead of the handful of members this repository actually defines. TypeDoc 0.28
 * has no built-in option for this, and `excludeNotDocumented` does not help
 * because `@types/three` ships doc comments of its own.
 */
export function load(application) {
  application.converter.on(Converter.EVENT_RESOLVE_BEGIN, (context) => {
    for (const reflection of context.project.getReflectionsByKind(
      ReflectionKind.ClassOrInterface,
    )) {
      const children = reflection.children ?? []
      for (const child of [...children]) {
        if (child.inheritedFrom !== undefined) context.project.removeReflection(child)
      }
    }
  })
}
