import { library, config } from '@fortawesome/fontawesome-svg-core'
import { all } from '@awesome.me/kit-c1511a7855/icons'

config.autoAddCss = false

library.add(...all)

export default defineNuxtPlugin(() => {})
