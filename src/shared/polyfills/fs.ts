// Browser-compatible fs polyfill - no-op stubs for Node.js fs methods
export const createReadStream = () => {
  throw new Error('fs.createReadStream is not available in the browser')
}

export const promises = {
  readFile: () => Promise.reject(new Error('fs.promises.readFile is not available in the browser')),
  writeFile: () => Promise.reject(new Error('fs.promises.writeFile is not available in the browser')),
}

export const statSync = () => {
  throw new Error('fs.statSync is not available in the browser')
}