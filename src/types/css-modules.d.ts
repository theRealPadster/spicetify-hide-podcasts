declare module '*.module.css' {
  const classes: { [key: string]: string };
  export default classes;
}

declare module '*.module.scss' {
  const classes: { [key: string]: string };
  export default classes;
}

// Plain (non-module) stylesheets are imported for their side effects only.
// TypeScript 6 errors on side-effect imports of undeclared modules (TS2882),
// so these need declaring even though they export nothing.
declare module '*.css';
declare module '*.scss';
