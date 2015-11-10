'use strict'

/**
 * add field 'Taxon ID VDI'
 * Fauna: infospecies.ch:infofauna:TaxonomieId
 * Flora: infospecies.ch:infoflora:TaxonomieId
 * Moose: infospecies.ch:nism:TaxonomieId
 * Pilze: infospecies.ch:swissfungi:TaxonomieId
 */

const couchPass = require('./couchPass.json')
const url = `http://${couchPass.user}:${couchPass.pass}@127.0.0.1:5984`
const nano = require('nano')(url)
const adb = nano.db.use('artendb_live')

const presetHash = {
  'Fauna': 'infospecies.ch:infofauna:',
  'Flora': 'infospecies.ch:infoflora:',
  'Moose': 'infospecies.ch:nism:',
  'Macromycetes': 'infospecies.ch:swissfungi:'
}
let docsWritten = 0

function bulkSave (docs) {
  let bulk = {}
  bulk.docs = docs
  adb.bulk(bulk, function (error, result) {
    if (error) return console.log('error after bulk:', error)
    docsWritten = docsWritten + docs.length
    console.log('docsWritten', docsWritten)
  })
}

adb.view('artendb', 'objekte', {
  'include_docs': true
}, (error, body) => {
  if (error) return console.log(error)
  let docs = []
  let docsPrepared = 0
  body.rows.forEach((row, index) => {
    const doc = row.doc
    if (doc.Gruppe && doc.Taxonomie && doc.Taxonomie.Eigenschaften && doc.Taxonomie.Eigenschaften['Taxonomie ID']) {
      const taxonomieId = doc.Taxonomie.Eigenschaften['Taxonomie ID']
      let save = false
      if (taxonomieId < 1000000) {
        const taxonIdVdi = presetHash[doc.Gruppe] + taxonomieId
        if (doc.Taxonomie.Eigenschaften['Taxon ID VDI'] !== taxonIdVdi) {
          doc.Taxonomie.Eigenschaften['Taxon ID VDI'] = presetHash[doc.Gruppe] + taxonomieId
          save = true
        }

      } else {
        // this species was added by FNS > no VDI ID needed
        if (doc.Taxonomie.Eigenschaften['Taxon ID VDI']) {
          delete doc.Taxonomie.Eigenschaften['Taxon ID VDI']
          save = true
        }
      }
      if (save) {
        // only save if something was changed
        docs.push(doc)
        if ((docs.length > 600) || (index === body.rows.length - 1)) {
          docsPrepared = docsPrepared + docs.length
          console.log('docsPrepared', docsPrepared)
          // save 600 docs
          bulkSave(docs.splice(0, 600))
        }
      }
    }
  })
})
