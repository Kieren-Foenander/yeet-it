import './styles.css'

import { Runtime } from 'foldkit'

import { flags, init, subscriptions, update } from './main.ts'
import { Flags, Model } from './model.ts'
import { view } from './view.ts'

const application = Runtime.makeApplication({
  Model,
  Flags,
  init,
  update,
  view,
  subscriptions,
  container: document.getElementById('root'),
})

Runtime.run(application, { flags })
