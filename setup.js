"use strict"

/*
  this script is created to run once to setup dynamodb-web 
*/

const db = require('./index')

const region = '';
const endpoint = '';

db.use({region, endpoint}).createUsers(err => {
  if (err) {
    console.error(err)
  } else {
    console.log('Created Users...')
  }
})

