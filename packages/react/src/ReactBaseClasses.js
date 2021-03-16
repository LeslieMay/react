/**
 * Copyright (c) Facebook, Inc. and its affiliates.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

import invariant from 'shared/invariant';

import ReactNoopUpdateQueue from './ReactNoopUpdateQueue';

const emptyObject = {};
if (__DEV__) {
  Object.freeze(emptyObject);
}

/**
 * Base class helpers for the updating state of a component.
 */
function Component(props, context, updater) {
  this.props = props;
  this.context = context;
  // If a component has string refs, we will assign a different object later.
  this.refs = emptyObject;
  // We initialize the default updater but the real one gets injected by the
  // renderer.
  this.updater = updater || ReactNoopUpdateQueue;
}
// 用来区分当前组件是react component
Component.prototype.isReactComponent = {};

/**
 * Sets a subset of the state. Always use this to mutate
 * state. You should treat `this.state` as immutable.
 *
 * There is no guarantee that `this.state` will be immediately updated, so
 * accessing `this.state` after calling this method may return the old value.
 *
 * There is no guarantee that calls to `setState` will run synchronously,
 * as they may eventually be batched together.  You can provide an optional
 * callback that will be executed when the call to setState is actually
 * completed.
 *
 * When a function is provided to setState, it will be called at some point in
 * the future (not synchronously). It will be called with the up to date
 * component arguments (state, props, context). These values can be different
 * from this.* because your function may be called after receiveProps but before
 * shouldComponentUpdate, and this new state, props, and context will not yet be
 * assigned to this.
 *
 * @param {object|function} partialState Next partial state or function to
 *        produce next partial state to be merged with current state.
 * @param {?function} callback Called after state is updated.
 * @final
 * @protected
 */
/**
 * 1. 改变状态用setState改变，不要this.state.xxx进行改变
 * 2. 执行了setState之后并不能保证this.state一定是立即更新的，如果在setState之后立即访问this.state，可能会拿到改变前的旧值
 * 3. 不能保证setState是同步执行的，setState可能会是批量执行，提供的参数回调函数会在setState执行之后调用
 * 4. 提供的回调函数会有最新的参数state，props，context，这些值和直接使用this.xxx得到的值可能是不一样的，
 *    因为回调函数可能会在receiveProps之后shouldComponentUpdate之前调用，此时新的state，props，context还没有重新赋值给this
 */
Component.prototype.setState = function(partialState, callback) {
  invariant(
    typeof partialState === 'object' ||
      typeof partialState === 'function' ||
      partialState == null,
    'setState(...): takes an object of state variables to update or a ' +
      'function which returns an object of state variables.',
  );
  this.updater.enqueueSetState(this, partialState, callback, 'setState');
};

/**
 * Forces an update. This should only be invoked when it is known with
 * certainty that we are **not** in a DOM transaction.
 *
 * You may want to call this when you know that some deeper aspect of the
 * component's state has changed but `setState` was not called.
 *
 * This will not invoke `shouldComponentUpdate`, but it will invoke
 * `componentWillUpdate` and `componentDidUpdate`.
 *
 * @param {?function} callback Called after update is complete.
 * @final
 * @protected
 */
Component.prototype.forceUpdate = function(callback) {
  this.updater.enqueueForceUpdate(this, callback, 'forceUpdate');
};

/**
 * Deprecated APIs. These APIs used to exist on classic React classes but since
 * we would like to deprecate them, we're not going to move them over to this
 * modern base class. Instead, we define a getter that warns if it's accessed.
 */
if (__DEV__) {
  const deprecatedAPIs = {
    isMounted: [
      'isMounted',
      'Instead, make sure to clean up subscriptions and pending requests in ' +
        'componentWillUnmount to prevent memory leaks.',
    ],
    replaceState: [
      'replaceState',
      'Refactor your code to use setState instead (see ' +
        'https://github.com/facebook/react/issues/3236).',
    ],
  };
  const defineDeprecationWarning = function(methodName, info) {
    Object.defineProperty(Component.prototype, methodName, {
      get: function() {
        console.warn(
          '%s(...) is deprecated in plain JavaScript React classes. %s',
          info[0],
          info[1],
        );
        return undefined;
      },
    });
  };
  for (const fnName in deprecatedAPIs) {
    if (deprecatedAPIs.hasOwnProperty(fnName)) {
      defineDeprecationWarning(fnName, deprecatedAPIs[fnName]);
    }
  }
}

// 利用寄生式继承 声明一个空的构造函数，将该构造函数的原型指向Component的原型，利用这个构造函数进行继承可以减少实例化Component产生不必要的实例属性，避免内存消耗
function ComponentDummy() {}
ComponentDummy.prototype = Component.prototype;

/**
 * Convenience component with default shallow equality check for sCU.
 */
function PureComponent(props, context, updater) {
  this.props = props;
  this.context = context;
  // If a component has string refs, we will assign a different object later.
  this.refs = emptyObject;
  this.updater = updater || ReactNoopUpdateQueue;
}
// 典型的寄生继承
const pureComponentPrototype = (PureComponent.prototype = new ComponentDummy());
// 修正constructor
pureComponentPrototype.constructor = PureComponent;
// Avoid an extra prototype jump for these methods.
// 将component上的原型提高一级到PureComponent上，避免利用__proto__再进行一次原型链向上查找
Object.assign(pureComponentPrototype, Component.prototype);
// 标识该组件是通过PureComponent组件
pureComponentPrototype.isPureReactComponent = true;

export {Component, PureComponent};

/**
 * 疑问：为什么不直接利用Object.assign 将Component.prototype合并到PureComponent.prototype呢？
 * 我的理解是，直接利用Object.assign会有几个问题
 * 1. Object.assign只能源对象的自身属性，不能拷贝继承属性，也不能拷贝不可枚举属性
 * 2. 利用Object.assign不能用instanceof 判断PureComponent的实例不是Component的实例，
 * 也就是说`PureComponent.prototype.__proto__` 指向的不是`Component.prototype`, 为什么不手动指定`__proto__`呢 ，因为这玩意有兼容性
 * 因此采用寄生继承保证`PureComponent.prototype.__proto__`指向`Component.prototype`,实现真正意义上的继承关系，
 * 然后再通过Object.assign去优化原型方法的链式查找，（Object.assign锦上添花）
 */
