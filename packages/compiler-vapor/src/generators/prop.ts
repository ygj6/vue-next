import type { CodegenContext } from '../generate'
import type { SetArrPropsIRNode, SetObjPropsIRNode, SetPropIRNode } from '../ir'
import { genExpression } from './expression'
import { isString } from '@vue/shared'
import { NewlineType } from '@vue/compiler-core'

export function genSetProp(oper: SetPropIRNode, context: CodegenContext) {
  const { pushFnCall, pushMulti, newline, vaporHelper, helper } = context

  newline()

  const element = `n${oper.element}`

  // fast path for static props
  if (isString(oper.key) || oper.key.isStatic) {
    const keyName = isString(oper.key) ? oper.key : oper.key.content

    let helperName: string | undefined
    let omitKey = false
    if (keyName === 'class') {
      helperName = 'setClass'
      omitKey = true
    } else if (keyName === 'style') {
      helperName = 'setStyle'
      omitKey = true
    } else if (oper.modifier) {
      helperName = oper.modifier === '.' ? 'setDOMProp' : 'setAttr'
    }

    if (helperName) {
      pushFnCall(
        vaporHelper(helperName),
        element,
        omitKey
          ? false
          : () => {
              const expr = () => genExpression(oper.key, context)
              if (oper.runtimeCamelize) {
                pushFnCall(helper('camelize'), expr)
              } else {
                expr()
              }
            },
        () => genExpression(oper.value, context),
      )
      return
    }
  }

  pushFnCall(
    vaporHelper('setDynamicProp'),
    element,
    // 2. key name
    () => {
      if (oper.runtimeCamelize) {
        pushFnCall(helper('camelize'), () => genExpression(oper.key, context))
      } else if (oper.modifier) {
        pushMulti([`\`${oper.modifier}\${`, `}\``], () =>
          genExpression(oper.key, context),
        )
      } else {
        genExpression(oper.key, context)
      }
    },
    () => genExpression(oper.value, context),
  )
}

export function genSetObjProps(
  oper: SetObjPropsIRNode,
  context: CodegenContext,
) {
  const { push, pushFnCall, newline, vaporHelper } = context

  newline()

  pushFnCall(vaporHelper('setObjProps'), `n${oper.element}`, () => {
    // TODO genObjectExpression
    if (!oper.value) {
      push('{}', NewlineType.None, oper.loc)
    }
    push('{')
    for (let i = 0; i < oper.value.length; i++) {
      const { key, value } = oper.value[i]
      push('[')
      genExpression(key, context)
      push(']:')
      genExpression(value, context)
      push(',')
    }
    push('}')
  })
}

export function genSetArrProps(
  oper: SetArrPropsIRNode,
  context: CodegenContext,
) {
  const { push, pushFnCall, newline, vaporHelper } = context

  newline()
  pushFnCall(
    vaporHelper('setArrProps'),
    `n${oper.element}`,
    () => {
      // TODO genArrayExpression
      push('[')
      for (let i = 0; i < oper.value.length; i++) {
        const props = oper.value[i]
        for (const prop of props) {
          // TODO genObjectExpression
          if ('key' in prop) {
            push('{')
            const { key, value } = prop
            push('[')
            genExpression(key, context)
            push(']:')
            genExpression(value, context)
            push(',')
            push('}')
          } else {
            genExpression(prop, context)
          }
          push(',')
        }
      }
      push(']')
    },
    `${oper.needMerge}`,
  )
}
