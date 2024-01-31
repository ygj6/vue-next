import {
  type AttributeNode,
  createCompilerError,
  type ElementNode,
  ElementTypes,
  ErrorCodes,
  ExpressionNode,
  isStaticExp,
  NodeTypes,
  type ObjectExpression,
} from '@vue/compiler-dom'
import { isBuiltInDirective, isReservedProp, isVoidTag } from '@vue/shared'
import {
  DirectiveTransformResult,
  NodeTransform,
  TransformContext,
} from '../transform'
import { IRNodeTypes, type VaporDirectiveNode } from '../ir'

export const transformElement: NodeTransform = (node, ctx) => {
  return function postTransformElement() {
    node = ctx.node

    if (
      !(
        node.type === NodeTypes.ELEMENT &&
        (node.tagType === ElementTypes.ELEMENT ||
          node.tagType === ElementTypes.COMPONENT)
      )
    ) {
      return
    }

    const { tag, props } = node
    const isComponent = node.tagType === ElementTypes.COMPONENT

    ctx.template += `<${tag}`
    if (props.length) {
      buildProps(
        node,
        ctx as TransformContext<ElementNode>,
        undefined,
        isComponent,
      )
    }
    ctx.template += `>` + ctx.childrenTemplate.join('')

    // TODO remove unnecessary close tag, e.g. if it's the last element of the template
    if (!isVoidTag(tag)) {
      ctx.template += `</${tag}>`
    }
  }
}

function buildProps(
  node: ElementNode,
  context: TransformContext<ElementNode>,
  props: ElementNode['props'] = node.props,
  isComponent: boolean,
) {
  const expressions = []
  const properties: ObjectExpression['properties'] = []
  const mergeArgs: ExpressionNode[] = []

  const pushMergeArg = (arg?: ExpressionNode) => {
    if (properties.length) {
      // TODO dedupe properties
      mergeArgs.push([...properties])
      properties.length = 0
    }
  }

  for (const prop of props) {
    if (prop.type === NodeTypes.DIRECTIVE) {
      const isVBind = prop.name === 'bind'
      if (!prop.arg && isVBind) {
        if (prop.exp) {
          if (isVBind) {
            pushMergeArg()
            expressions.push(prop.exp)
            mergeArgs.push([prop.exp])
          }
        } else {
          context.options.onError(
            createCompilerError(ErrorCodes.X_V_BIND_NO_EXPRESSION, prop.loc),
          )
        }
        continue
      }
    }

    const result = transformProp(
      prop as VaporDirectiveNode | AttributeNode,
      node,
      context,
    )
    if (result) {
      const { props: propsObj } = result
      for (const prop of propsObj) {
        !isStaticExp(prop.key) && expressions.push(prop.key)
        !isStaticExp(prop.value) && expressions.push(prop.value)
      }
      properties.push(...propsObj)
    }
  }

  if (mergeArgs.length) {
    pushMergeArg()
    if (mergeArgs.length > 1) {
      context.registerEffect(expressions, [
        {
          type: IRNodeTypes.SET_ARR_PROPS,
          loc: node.loc,
          element: context.reference(),
          value: mergeArgs,
          needMerge: true,
        },
      ])
    } else {
      context.registerEffect(expressions, [
        {
          type: IRNodeTypes.SET_ARR_PROPS,
          loc: node.loc,
          element: context.reference(),
          value: mergeArgs,
          needMerge: false,
        },
      ])
    }
  } else if (properties.length) {
    let hasDynamicKey = false
    for (let i = 0; i < properties.length; i++) {
      const key = properties[i].key
      if (isStaticExp(key)) {
        // todo
      } else if (!key.isHandlerKey) {
        hasDynamicKey = true
      }
    }
    if (!hasDynamicKey) {
      // TODO handle class/style prop
      for (const prop of properties) {
        context.registerEffect(
          [prop.value],
          [
            {
              ...prop,
              type: IRNodeTypes.SET_PROP,
              loc: prop.loc,
              element: context.reference(),
              key: prop.key,
              value: prop.value,
            },
          ],
        )
      }
    } else {
      context.registerEffect(expressions, [
        {
          type: IRNodeTypes.SET_OBJ_PROPS,
          loc: node.loc,
          element: context.reference(),
          value: properties,
        },
      ])
    }
  }
}

function transformProp(
  prop: VaporDirectiveNode | AttributeNode,
  node: ElementNode,
  context: TransformContext<ElementNode>,
): void | DirectiveTransformResult {
  const { name, loc } = prop
  if (isReservedProp(name)) return

  if (prop.type === NodeTypes.ATTRIBUTE) {
    context.template += ` ${name}`
    if (prop.value) context.template += `="${prop.value.content}"`
    return
  }

  const directiveTransform = context.options.directiveTransforms[name]
  if (directiveTransform) {
    return directiveTransform(prop, node, context)
  } else if (!isBuiltInDirective(name)) {
    context.registerOperation({
      type: IRNodeTypes.WITH_DIRECTIVE,
      element: context.reference(),
      dir: prop,
      loc,
    })
  }
}
