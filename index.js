"use strict"

const DatabaseAbstractor = require('database-abstractor');

const userdb = new DatabaseAbstractor();

/* for generate user LOGIN token */
const jwt = require('jsonwebtoken');
const keys = {
  account: process.env.AUTH_KEY_ACCOUNT,
  admin: process.env.AUTH_KEY_ADMIN,
  super: process.env.AUTH_KEY_SUPER
};


module.exports = {

  _dbready: false,

  _tables: null,

  _users: {},

  queue: [],

  use({region, endpoint}) {

    userdb.use(require('@stormgle/userdb-dynamodb-driver')(
      { region, endpoint },
      (err, data) => {
        if (err) {
          console.log('Failed to access database')
          throw new Error(err)
        } else {
          this._dbready = true;
          this._tables = data.TableNames;
          if (this.queue.length > 0) {
            this.queue.forEach(fn => this[fn.name].apply(this,fn.args))
          }
        }
      }
    ))

    return this;
  },

  init(done) {
    if (this._tables) {
      if (this._tables.indexOf('USERS') === -1) {
        console.log('Initializing USER Table...')
        return this.new(() => {
          console.log('USER Table is created and ready to use.');
          done && done();
        });
      } else {
        console.log('USERS Collection already exists');
        done && done();
        return this;
      }
    } else {
      this.queue.push({name: 'init', args: [done]})
    }
  },

  new(done) {
    if (this._dbready) {
      userdb.createTable((err, data) => {
        if (err) {
          console.log('Failed to create table')
          console.log(err);
        } else {  
          this._createUsers(done);
        }
      })
    } else {
      this.queue.push({name: 'new', args: [done]})
    }
    return this;
  },

  reset () {
    const self = this;
    if (this._dbready) {
      userdb.dropTable(function(err, data) {
        if (err) {
          console.log('Failed to drop USERS table')
          console.log(err);
        } else {
          console.log('Dropped old USERS table')
          userdb.createTable((err, data) => {
            if (err) {
              console.log('Failed to create table')
              console.log(err);
            } else {  
              self._createUsers();
            }
          })
        }
      })
    } else {
      this.queue.push({name: 'reset', args: [done]})
    }
    return this;
  },

  createUsers(done) {
    if (this._dbready && this._tables && this._tables.indexOf('USERS') !== -1) {
      this._createUsers(done);
    } else {
      this.queue.push({name: 'createUsers', args: [done]})
    }
    return this;
  },

  _createUser(name, user) {
    const username = user.username;
    const password = user.login.password;
    return new Promise((resolve, reject) => {
      userdb.createUser(
        user,
        (err, usr) => {
          if (err) {
            reject();
          } else {
            console.log(`  -> ${name} user is: ${username} / ${password}`)
            this._users[name] = usr;
            this._users[name].login.password = password; // restore original (not hased) password
            this._users[name].login.token = this._genLoginToken(usr);
            resolve();  
          }
        }
      )     
    })
  },

  _genLoginToken(user) {
    const tokens = {}    
    const policies = user.policies;        
    for(let policy in policies) {    
      if (keys[policy]) {
        const token = jwt.sign({
          uid: user.uid,
        }, keys[policy], {
          expiresIn: "14 days"
        });
        tokens[policy] = token;
      }   
    }
    return tokens;
  },

  _createUsers(done) {
    console.log('Creating users...')  
    Promise.all([
      this._createUser('super', {
        username: 'super@team.com',
        login: { password: 'qwe'},
        roles: ['super'],
        uid: 'super-amin-special-uid',
        profile: { email: ['super@team.com']}
      }),
      this._createUser('admin', {
        username: 'admin@team.com',
        login: { password: 'qwe'},
        roles: ['admin','user'],
        uid: 'admin-special-uid',
        profile: { email: ['admin@team.com']}
      }),
      this._createUser('tester', {
        username: 'tester@team.com',
        login: { password: '123'},
        roles: ['user'],
        uid: 'tester-uid',
        profile: { email: ['tester@team.com'], fullName: 'Awesome Tester', phone: ['097 111 1111'], address: 'Team Test, Prod. Department, Organization'},
        promote: { course: {'emb-01' : 50000 }}
      })      
    ]).then(values => {
      console.log('Created users.')
      done && done();
    }).catch(function(err) {
      console.log(err);
      done && done(err);
    });
    return this;
  },

  getUser(name) {
    return this._users[name];
  }

}

