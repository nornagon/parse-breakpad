const readline = require('readline')
const GoogAvlTree = require('./goog-avl')

const binaryTree = {
  newTree: () => new GoogAvlTree((a, b) => a.address - b.address),
  lb: (tree, k) => {
    let node = null
    tree.reverseOrderTraverse((n) => {
      node = n
      return true
    }, {address: k})
    return node
  },
  insert: (tree, v) => tree.add(v)
}

async function parse(readable) {
  const rl = readline.createInterface({
    input: readable,
    crlfDelay: Infinity
  })

  const functionIntervals = binaryTree.newTree()
  const publicAddresses = binaryTree.newTree()

  const symbolFile = {
    functions: functionIntervals,
    publicAddresses: publicAddresses,
    lookup(offset) {
      const func = binaryTree.lb(this.functions, offset)
      if (func && offset < func.address + func.size) {
        return { func }
      }
      const public = binaryTree.lb(this.publicAddresses, offset)
      if (public) {
        return { func: public }
      }
    }
  }

  const filesById = new Map

  let lastFunc = null
  for await (const line of rl) {
    let m
    if (m = /^([0-9a-f]+) ([0-9a-f]+) (\d+) (\d+)$/.exec(line)) { // this is first because it's the most common kind
      if (lastFunc) {
        const [, addressHex, sizeHex, lineNumber, fileId] = m
        const address = parseInt(addressHex, 16)
        const size = parseInt(sizeHex, 16)
        const file = filesById.get(fileId)
        const line = parseInt(lineNumber, 10)
        lastFunc.lines.push({address, size, file, line})
      }
    } else if (m = /^MODULE (\S+) (\S+) (\S+) (.+)$/.exec(line)) {
      const [, os, arch, id, name] = m
      symbolFile.module = { os, arch, id, name }
    } else if (m = /^FILE (\d+) (.+)$/.exec(line)) {
      const [, fileId, fileName] = m
      filesById.set(fileId, fileName)
    } else if (m = /^FUNC (?:(m) )?([0-9a-f]+) ([0-9a-f]+) ([0-9a-f]+) (.+)$/.exec(line)) {
      const [, multiple, addressHex, sizeHex, parameterSizeHex, name] = m
      const address = parseInt(addressHex, 16)
      const size = parseInt(sizeHex, 16)
      const parameterSize = parseInt(parameterSizeHex, 16)
      const func = { address, size, parameterSize, name, multiple: !!multiple, lines: [] }
      binaryTree.insert(functionIntervals, func)
      lastFunc = func
    } else if (m = /^PUBLIC (?:(m) )?([0-9a-f]+) ([0-9a-f]+) (.+)$/.exec(line)) {
      const [, multiple, addressHex, parameterSizeHex, name] = m
      const address = parseInt(addressHex, 16)
      const parameterSize = parseInt(parameterSizeHex, 16)
      const func = { address, parameterSize, name, multiple: !!multiple }
      binaryTree.insert(publicAddresses, func)
    } else {
      // There are some other records (STACK WIN, STACK CFI) that can
      // occur in breakpad symbol files, but we ignore them for now.
    }
  }

  return symbolFile
}

module.exports = { parse }
