import { defineBuildConfig } from 'unbuild'

export default defineBuildConfig({
  entries: [
    'src/index',
    'src/unocss.worker',
  ],
  declaration: true,
  clean: true,
  rollup: {
    emitCJS: true,
  },
})
