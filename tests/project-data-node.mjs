import {createProjectDataReader,projectDataWarning} from '../src/project-data.js';
import run from './project-data-cases.cjs';
await run(createProjectDataReader,projectDataWarning);
