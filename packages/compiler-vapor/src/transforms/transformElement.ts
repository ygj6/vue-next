import {
  type AttributeNode,
  type ElementNode,
  ElementTypes,
  ErrorCodes,
  NodeTypes,
  type SimpleExpressionNode,
  createCompilerError,
} from '@vue/compiler-dom'
import {
  isBuiltInDirective,
  isReservedProp,
  isString,
  isVoidTag,
} from '@vue/shared'
import type {
  DirectiveTransformResult,
  NodeTransform,
  TransformContext,
} from '../transform'
import {
  type IRExpression,
  IRNodeTypes,
  type PropsExpression,
  type VaporDirectiveNode,
} from '../ir'

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
  const elementLoc = node.loc
  const expressions: IRExpression[] = []
  let transformResults: DirectiveTransformResult[] = []
  const mergeArgs: PropsExpression[] = []

  const pushMergeArg = () => {
    if (transformResults.length) {
      // TODO dedupe
      mergeArgs.push([...transformResults])
      transformResults.length = 0
    }
  }

  for (const prop of props) {
    if (prop.type === NodeTypes.DIRECTIVE) {
      const isVBind = prop.name === 'bind'
      if (!prop.arg && isVBind) {
        if (prop.exp) {
          if (isVBind) {
            pushMergeArg()
            expressions.push(prop.exp as SimpleExpressionNode)
            mergeArgs.push(prop.exp as SimpleExpressionNode)
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
    // the prop need to be merged
    if (result) {
      expressions.push(result.key, result.value)
      transformResults.push(result)
    }
  }

  if (mergeArgs.length) {
    pushMergeArg()
    context.registerEffect(expressions, [
      {
        type: IRNodeTypes.SET_MERGE_BATCH_PROPS,
        loc: elementLoc,
        element: context.reference(),
        value: mergeArgs,
      },
    ])
  } else if (transformResults.length) {
    let hasDynamicKey = false
    for (let i = 0; i < transformResults.length; i++) {
      const key = transformResults[i].key
      if (isString(key) || key.isStatic) {
        // TODO
      } else if (!key.isHandlerKey) {
        hasDynamicKey = true
      }
    }
    if (!hasDynamicKey) {
      // TODO handle class/style prop
      context.registerEffect(expressions, [
        {
          type: IRNodeTypes.SET_PROP,
          loc: elementLoc,
          element: context.reference(),
          value: transformResults,
        },
      ])
    } else {
      context.registerEffect(expressions, [
        {
          type: IRNodeTypes.SET_BATCH_PROPS,
          loc: elementLoc,
          element: context.reference(),
          value: transformResults,
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
