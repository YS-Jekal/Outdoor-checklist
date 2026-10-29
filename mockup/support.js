(function () {
  'use strict';

  class DCLogic {
    constructor(props) { this.props = props || {}; this.state = {}; this.__draw = function () {}; }
    setState(partial) { this.state = Object.assign({}, this.state, partial || {}); this.__draw(); }
    forceUpdate() { this.__draw(); }
  }
  window.DCLogic = DCLogic;

  function pathValue(path, scope) {
    if (path === 'true') return true;
    if (path === 'false') return false;
    return path.split('.').reduce(function (value, key) {
      if (key === '$index') return value && value.$index;
      return value == null ? undefined : value[key];
    }, scope);
  }
  function expression(text, scope) {
    var match = /^\s*\{\{\s*([^{}]+?)\s*\}\}\s*$/.exec(text);
    return match ? pathValue(match[1], scope) : text.replace(/\{\{\s*([^{}]+?)\s*\}\}/g, function (_, path) {
      var value = pathValue(path.trim(), scope);
      return value == null ? '' : String(value);
    });
  }
  function renderChildren(source, scope, destination, component) {
    Array.prototype.forEach.call(source.childNodes, function (node) {
      if (node.nodeType === Node.TEXT_NODE) {
        var text = expression(node.nodeValue, scope);
        destination.appendChild(document.createTextNode(text == null ? '' : String(text)));
        return;
      }
      if (node.nodeType !== Node.ELEMENT_NODE) return;
      var tag = node.localName.toLowerCase();
      if (tag === 'sc-if') {
        if (expression(node.getAttribute('value') || '', scope)) renderChildren(node, scope, destination, component);
        return;
      }
      if (tag === 'sc-for') {
        var list = expression(node.getAttribute('list') || '', scope);
        var alias = node.getAttribute('as') || 'item';
        if (Array.isArray(list)) list.forEach(function (item, index) {
          var nested = Object.create(scope);
          nested[alias] = item;
          nested.$index = index;
          renderChildren(node, nested, destination, component);
        });
        return;
      }
      var clone = node.namespaceURI === 'http://www.w3.org/2000/svg'
        ? document.createElementNS(node.namespaceURI, node.nodeName) : document.createElement(node.nodeName);
      Array.prototype.forEach.call(node.attributes, function (attr) {
        var result = expression(attr.value, scope);
        if (/^on[a-z]+$/i.test(attr.name) && typeof result === 'function') {
          clone.addEventListener(attr.name.slice(2).toLowerCase(), function (event) { result.call(component, event); });
        } else if (result != null) clone.setAttribute(attr.name, String(result));
      });
      renderChildren(node, scope, clone, component);
      destination.appendChild(clone);
    });
  }
  function boot() {
    try {
      var root = document.querySelector('x-dc');
      var code = document.querySelector('script[type="text/x-dc"][data-dc-script]');
      if (!root || !code) throw new Error('화면 템플릿 또는 컴포넌트 스크립트를 찾을 수 없습니다.');
      var helmet = root.querySelector('helmet');
      if (helmet) { Array.from(helmet.childNodes).forEach(function (child) { document.head.appendChild(child.cloneNode(true)); }); helmet.remove(); }
      var template = document.createElement('template');
      template.innerHTML = root.innerHTML;
      root.remove();
      var ComponentClass = Function(code.textContent + '\n;return Component;')();
      var component = new ComponentClass(JSON.parse(code.getAttribute('data-props') || '{}'));
      var draw = function () {
        var y = window.scrollY;
        var values = component.renderVals() || {};
        var scope = Object.assign(Object.create(null), values, { props: component.props, state: component.state });
        var fragment = document.createDocumentFragment();
        renderChildren(template.content, scope, fragment, component);
        document.body.replaceChildren(fragment);
        window.scrollTo(0, y);
      };
      component.__draw = draw;
      draw();
    } catch (error) {
      document.body.innerHTML = '';
      var message = document.createElement('pre');
      message.style.cssText = 'color:#c00;white-space:pre-wrap;padding:16px;font:14px monospace';
      message.textContent = error && error.stack ? error.stack : String(error);
      document.body.appendChild(message);
    }
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot);
  else boot();
}());
