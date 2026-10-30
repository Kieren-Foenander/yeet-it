import './styles.css'

import { Runtime } from 'foldkit'

import { Flags, flags, init, Model, update, view } from './main.ts'

const application = Runtime.makeApplication({
  Model,
  Flags,
  init,
  update,
  view,
  container: document.getElementById('root'),
})

Runtime.run(application, { flags })
