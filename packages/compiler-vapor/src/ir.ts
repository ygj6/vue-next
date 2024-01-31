import type {
  BindingTypes,
  CompoundExpressionNode,
  DirectiveNode,
  RootNode,
  SimpleExpressionNode,
  SourceLocation,
  TemplateChildNode,
} from '@vue/compiler-dom'
import type { Prettify } from '@vue/shared'
import type { DirectiveTransform, NodeTransform } from './transform'

export enum IRNodeTypes {
  ROOT,
  TEMPLATE_FACTORY,
  FRAGMENT_FACTORY,

  SET_PROP,
  SET_OBJ_PROPS,
  SET_ARR_PROPS,
  SET_TEXT,
  SET_EVENT,
  SET_HTML,
  SET_REF,
  SET_MODEL_VALUE,

  INSERT_NODE,
  PREPEND_NODE,
  APPEND_NODE,
  CREATE_TEXT_NODE,

  WITH_DIRECTIVE,

  IF,
  BLOCK_FUNCTION,
}

export interface BaseIRNode {
  type: IRNodeTypes
  loc: SourceLocation
}

// TODO refactor
export type VaporHelper = keyof typeof import('../../runtime-vapor/src')

export interface BlockFunctionIRNode extends BaseIRNode {
  type: IRNodeTypes.BLOCK_FUNCTION
  node: RootNode | TemplateChildNode
  templateIndex: number
  dynamic: IRDynamicInfo
  effect: IREffect[]
  operation: OperationNode[]
}

export interface RootIRNode extends Omit<BlockFunctionIRNode, 'type'> {
  type: IRNodeTypes.ROOT
  node: RootNode
  source: string
  template: Array<TemplateFactoryIRNode | FragmentFactoryIRNode>
}

export interface IfIRNode extends BaseIRNode {
  type: IRNodeTypes.IF
  id: number
  condition: IRExpression
  positive: BlockFunctionIRNode
  negative?: BlockFunctionIRNode | IfIRNode
}

export interface TemplateFactoryIRNode extends BaseIRNode {
  type: IRNodeTypes.TEMPLATE_FACTORY
  template: string
}

export interface FragmentFactoryIRNode extends BaseIRNode {
  type: IRNodeTypes.FRAGMENT_FACTORY
}

export interface SetPropIRNode extends BaseIRNode {
  type: IRNodeTypes.SET_PROP
  element: number
  key: IRExpression
  value: IRExpression
  modifier?: '.' | '^'
  runtimeCamelize: boolean
}

export interface SetObjPropsIRNode extends BaseIRNode {
  type: IRNodeTypes.SET_OBJ_PROPS
  element: number
  value: any
}

export interface SetArrPropsIRNode extends BaseIRNode {
  type: IRNodeTypes.SET_ARR_PROPS
  element: number
  value: any
  needMerge: boolean
}

export interface SetTextIRNode extends BaseIRNode {
  type: IRNodeTypes.SET_TEXT
  element: number
  value: IRExpression
}

export type KeyOverride = [find: string, replacement: string]
export interface SetEventIRNode extends BaseIRNode {
  type: IRNodeTypes.SET_EVENT
  element: number
  key: IRExpression
  value?: SimpleExpressionNode
  modifiers: {
    // modifiers for addEventListener() options, e.g. .passive & .capture
    options: string[]
    // modifiers that needs runtime guards, withKeys
    keys: string[]
    // modifiers that needs runtime guards, withModifiers
    nonKeys: string[]
  }
  keyOverride?: KeyOverride
}

export interface SetHtmlIRNode extends BaseIRNode {
  type: IRNodeTypes.SET_HTML
  element: number
  value: IRExpression
}

export interface SetRefIRNode extends BaseIRNode {
  type: IRNodeTypes.SET_REF
  element: number
  value: IRExpression
}

export interface SetModelValueIRNode extends BaseIRNode {
  type: IRNodeTypes.SET_MODEL_VALUE
  element: number
  key: IRExpression
  value: IRExpression
  bindingType?: BindingTypes
  isComponent: boolean
}

export interface CreateTextNodeIRNode extends BaseIRNode {
  type: IRNodeTypes.CREATE_TEXT_NODE
  id: number
  value: IRExpression
}

export interface InsertNodeIRNode extends BaseIRNode {
  type: IRNodeTypes.INSERT_NODE
  element: number | number[]
  parent: number
  anchor: number
}

export interface PrependNodeIRNode extends BaseIRNode {
  type: IRNodeTypes.PREPEND_NODE
  elements: number[]
  parent: number
}

export interface AppendNodeIRNode extends BaseIRNode {
  type: IRNodeTypes.APPEND_NODE
  elements: number[]
  parent: number
}

export interface WithDirectiveIRNode extends BaseIRNode {
  type: IRNodeTypes.WITH_DIRECTIVE
  element: number
  dir: VaporDirectiveNode
  builtin?: string
}

export type IRNode =
  | OperationNode
  | RootIRNode
  | TemplateFactoryIRNode
  | FragmentFactoryIRNode
export type OperationNode =
  | SetPropIRNode
  | SetObjPropsIRNode
  | SetArrPropsIRNode
  | SetTextIRNode
  | SetEventIRNode
  | SetHtmlIRNode
  | SetRefIRNode
  | SetModelValueIRNode
  | CreateTextNodeIRNode
  | InsertNodeIRNode
  | PrependNodeIRNode
  | AppendNodeIRNode
  | WithDirectiveIRNode
  | IfIRNode

export type BlockIRNode = RootIRNode | BlockFunctionIRNode

export enum DynamicFlag {
  NONE = 0,
  /**
   * This node is referenced and needs to be saved as a variable.
   */
  REFERENCED = 1,
  /**
   * This node is not generated from template, but is generated dynamically.
   */
  NON_TEMPLATE = 1 << 1,
  /**
   * This node needs to be inserted back into the template.
   */
  INSERT = 1 << 2,
}

export interface IRDynamicInfo {
  id: number | null
  dynamicFlags: DynamicFlag
  anchor: number | null
  children: IRDynamicInfo[]
}

export type IRExpression = SimpleExpressionNode | string
export interface IREffect {
  // TODO multi-expression effect
  expressions: IRExpression[]
  operations: OperationNode[]
}

type Overwrite<T, U> = Pick<T, Exclude<keyof T, keyof U>> &
  Pick<U, Extract<keyof U, keyof T>>

export type HackOptions<T> = Prettify<
  Overwrite<
    T,
    {
      nodeTransforms?: NodeTransform[]
      directiveTransforms?: Record<string, DirectiveTransform | undefined>
    }
  >
>

export type VaporDirectiveNode = Overwrite<
  DirectiveNode,
  {
    exp: Exclude<DirectiveNode['exp'], CompoundExpressionNode>
    arg: Exclude<DirectiveNode['arg'], CompoundExpressionNode>
  }
>
