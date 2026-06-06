// Importing this file is the single entry point that materializes
// every model. Side-effect imports register models on the shared
// sequelize instance and wire up associations. `src/index.ts` does
// `import './model/index.js'` once at boot so the rest of the app
// can `import { User, Post } from './model/index.js'` directly.

import User from './user.js';
import Post from './post.js';

export { User, Post };
