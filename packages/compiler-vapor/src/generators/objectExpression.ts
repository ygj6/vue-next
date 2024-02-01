import {
  NewlineType,
  type ObjectExpression,
  type SimpleExpressionNode,
  type SourceLocation,
  isSimpleIdentifier,
} from '@vue/compiler-dom'
import type { CodegenContext } from '../generate'
import { genExpression } from './expression'
import type { IRExpression } from '@vue/compiler-vapor'
import { isString } from '@vue/shared'

export function genObjectExpression(
  node: ObjectExpression,
  context: CodegenContext,
): void {
  const { push, withIndent, newline } = context
  const { properties, loc } = node
  if (!properties.length) {
    push(`{}`, NewlineType.None, loc)
  }
  const multilines = properties.length > 1
  push(multilines ? `{` : `{ `)
  const genProperties = () => {
    for (let i = 0; i < properties.length; i++) {
      const { key, value, loc } = properties[i]
      // key
      genExpressionAsPropertyKey(key as SimpleExpressionNode, loc, context)
      push(': ')
      // value
      genExpression(value as SimpleExpressionNode, context)
      if (i < properties.length - 1) {
        // will only reach this if it's multilines
        push(',')
        newline()
      }
    }
  }
  multilines
    ? withIndent(() => {
        newline()
        genProperties()
        newline()
      })
    : genProperties()
  push(multilines ? '}' : ' }')
}

function genExpressionAsPropertyKey(
  node: IRExpression,
  loc: SourceLocation,
  context: CodegenContext,
) {
  const { push, pushMulti } = context
  if (isString(node) || node.isStatic) {
    const keyName = isString(node) ? node : node.content
    // only quote keys if necessary
    const text = isSimpleIdentifier(keyName) ? keyName : JSON.stringify(keyName)
    push(text, NewlineType.None, loc)
  } else {
    pushMulti(['[', ']'], () => genExpression(node, context))
  }
}
