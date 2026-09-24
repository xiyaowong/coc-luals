import wongxy from '@wongxy/eslint-config'

export default wongxy({
  ignores: ['settings.md'],
  rules: {
    'node/prefer-global/process': 'off',
  },
})
