import buble from 'rollup-plugin-buble'
import flow from 'rollup-plugin-flow'
import resolve from 'rollup-plugin-node-resolve'

export default {
  entry: 'ffi/Control/Stream/index.js',
  dest: 'src/Control/Stream.js',
  format: 'cjs',
  plugins: [
    flow(),
    buble(),
    resolve({ module: true, jsnext: true })
  ]
}
