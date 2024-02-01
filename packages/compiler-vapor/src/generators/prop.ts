import type { CodegenContext } from '../generate'
import type {
  SetBatchPropsIRNode,
  SetMergeBatchPropsIRNode,
  SetPropIRNode,
} from '../ir'
import { genExpression } from './expression'
import { isString } from '@vue/shared'
import {
  type ObjectExpression,
  type SourceLocation,
  createObjectExpression,
  createObjectProperty,
} from '@vue/compiler-core'
import { genObjectExpression } from './objectExpression'
import type { DirectiveTransformResult } from '../transform'

export function genSetProp(oper: SetPropIRNode, context: CodegenContext) {
  const { pushFnCall, newline, vaporHelper } = context

  newline()

  for (const { key, value, modifier } of oper.value) {
    const keyName = isString(key) ? key : key.content

    let helperName: string | undefined
    let omitKey = false
    if (keyName === 'class') {
      helperName = 'setClass'
      omitKey = true
    } else if (keyName === 'style') {
      helperName = 'setStyle'
      omitKey = true
    } else if (modifier) {
      helperName = modifier === '.' ? 'setDOMProp' : 'setAttr'
    }

    if (helperName) {
      pushFnCall(
        vaporHelper(helperName),
        `n${oper.element}`,
        omitKey ? false : () => genExpression(key, context),
        () => genExpression(value, context),
      )
    }
  }
}

export function genSetBatchProps(
  oper: SetBatchPropsIRNode,
  context: CodegenContext,
) {
  const { pushFnCall, newline, vaporHelper } = context

  newline()

  pushFnCall(vaporHelper('setBatchProps'), `n${oper.element}`, () =>
    genLiteralObjectProp(oper.value, oper.loc, context),
  )
}

export function genMergeBatchProps(
  oper: SetMergeBatchPropsIRNode,
  context: CodegenContext,
) {
  const { pushMulti, pushFnCall, newline, vaporHelper } = context

  newline()
  pushFnCall(vaporHelper('mergeBatchProps'), `n${oper.element}`, () => {
    pushMulti(
      ['[', ']', ', '],
      // props to be merged
      ...oper.value.map(prop => () => {
        Array.isArray(prop)
          ? genLiteralObjectProp(prop, oper.loc, context)
          : genExpression(prop, context)
      }),
    )
  })
}

function genLiteralObjectProp(
  prop: DirectiveTransformResult[],
  loc: SourceLocation,
  context: CodegenContext,
) {
  const { helper } = context
  const properties: ObjectExpression['properties'] = []
  for (const { key, value, runtimeCamelize, modifier } of prop) {
    if (runtimeCamelize) {
      key.content = `${helper('camelize')}(${key.content})`
    } else if (modifier) {
      key.content = `${modifier}${key.content}`
    }
    properties.push(createObjectProperty(key, value))
  }
  genObjectExpression(createObjectExpression(properties, loc), context)
}
