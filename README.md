# Implentasi Soft Delete

## Inisialisasi project typescript

```shell
# membuat directory project
mkdir soft-delete-prisma

# masuk ke directory project
cd soft-delete-prisma/

# Inisialisasi project
npm init -y

# Tambahkan depedensi prisma, typescript ts-node
npm install prisma typescript ts-node @types/node --save-dev

# Inisialisasi typescript
npx tsc --init

# Inisialisasi prisma
npx prisma init

npm install @prisma/client
```


## Membuat Skema Prisma

1. Sesuaikan environtment variabel di file .env

    ```env
    DATABASE_URL="mysql://johndoe:randompassword@localhost:5432/mydb?schema=public"
    ```
   
2. Buat skema database di ```./prisma/schema.prisma``` :

    ```prisma
    generator client {
      provider = "prisma-client-js"
    }
    
    datasource db {
      provider = "mysql"
      url      = env("DATABASE_URL")
    }
    
    
    model User {
      id        Int     @id @default(autoincrement())
      name      String?
      email     String  @unique
      posts     Post[]
      followers User[]  @relation("UserToUser")
      user      User?   @relation("UserToUser", fields: [userId], references: [id])
      userId    Int?
    }
    
    model Post {
      id      Int     @id @default(autoincrement())
      title   String
      content String?
      user    User?   @relation(fields: [userId], references: [id])
      userId  Int?
      tags    Tag[]
      views   Int     @default(0)
      deleted Boolean @default(false)
    }
    
    model Category {
      id             Int        @id @default(autoincrement())
      parentCategory Category?  @relation("CategoryToCategory", fields: [categoryId], references: [id])
      category       Category[] @relation("CategoryToCategory")
      categoryId     Int?
    }
    
    model Tag {
      tagName String @id // Must be unique
      posts   Post[]
    }
    ```
   
    Coba perhatikan model Post, terdapat property deleted.
    
    ```shell
    # Jalankan 
    npx prisma migrate dev --name init
    ```

## Soft Delete dengan Middleware

Contoh berikut menggunakan middleware untuk melakukan soft delete . Soft Delete berarti Post ditandai sebagai dihapus dengan mengubah bidang seperti ```deleted``` daripada ```true``` benar-benar dihapus dari database. Alasan untuk menggunakan soft delete meliputi:
- Persyaratan peraturan yang berarti Anda harus menyimpan data untuk jangka waktu tertentu
- Fungsionalitas 'Trash' / 'bin' yang memungkinkan pengguna memulihkan konten yang telah dihapus

### Langkah 1: Simpan status record

Tambahkan kolom bernama ```deleted``` ke model ```Post```. Anda dapat memilih antara dua jenis kolom tergantung pada kebutuhan Anda:
- ```Boolean``` dengan nilai default ```false```:

    ```prisma
    model Post {
      id      Int     @id @default(autoincrement())
       
      deleted Boolean @default(false)
    }
    ```

- Buat ```DateTime``` bidang yang dapat dibatalkan sehingga Anda tahu persis kapan catatan ditandai sebagai dihapus - ```NULL``` menunjukkan bahwa catatan belum dihapus. Dalam beberapa kasus, menyimpan saat catatan dihapus mungkin merupakan persyaratan peraturan:

    ```prisma
    model Post {
      id      Int       @id @default(autoincrement())
       
      deleted DateTime?
    }
    ```
  Catatan : Menggunakan dua bidang terpisah ( ```isDeleted``` dan ```deletedDate```) dapat menyebabkan kedua bidang ini menjadi tidak sinkron - misalnya, rekaman mungkin ditandai sebagai dihapus tetapi tidak memiliki tanggal terkait.)


### Langkah 2: Soft Delete Middleware

Tambahkan middleware yang melakukan tugas-tugas berikut:
- Menangani kueri ```delete``` dan ```deleteMany``` untuk model ```Post```.
- Mengubah ```params.action``` ke ```update``` dan ```updateMany``` masing-masing
- Memperkenalkan dataargumen dan set { deleted: true }, mempertahankan argumen filter lain jika ada

- Jalankan contoh berikut untuk menguji soft delete middleware:

    ```shell
    npx ts-node index.ts
    ```
    
    ```ts
    // index.ts
    
    import { PrismaClient } from '@prisma/client'
    
    const prisma = new PrismaClient({})
    
    async function main() {
        /***********************************/
        /* SOFT DELETE MIDDLEWARE */
        /***********************************/
    
        prisma.$use(async (params, next) => {
            // Check incoming query type
            if (params.model == 'Post') {
                if (params.action == 'delete') {
                    // Delete queries
                    // Change action to an update
                    params.action = 'update'
                    params.args['data'] = {deleted: true}
                }
                if (params.action == 'deleteMany') {
                    // Delete many queries
                    params.action = 'updateMany'
                    if (params.args.data != undefined) {
                        params.args.data['deleted'] = true
                    } else {
                        params.args['data'] = {deleted: true}
                    }
                }
            }
            return next(params)
        })
    
        /***********************************/
        /* TEST */
        /***********************************/
    
        const titles = [
            { title: 'How to create soft delete middleware' },
            { title: 'How to install Prisma' },
            { title: 'How to update a record' },
        ]
    
        console.log('\u001b[1;34mSTARTING SOFT DELETE TEST \u001b[0m')
        console.log('\u001b[1;34m#################################### \u001b[0m')
    
        let i = 0
        let posts = new Array()
    
        // Create 3 new posts with a randomly assigned title each time
        for (i == 0; i < 3; i++) {
            const createPostOperation = prisma.post.create({
                data: titles[Math.floor(Math.random() * titles.length)],
            })
            posts.push(createPostOperation)
        }
    
        var postsCreated = await prisma.$transaction(posts)
    
        console.log(
            'Posts created with IDs: ' +
            '\u001b[1;32m' +
            postsCreated.map((x) => x.id) +
            '\u001b[0m'
        )
    
        // Delete the first post from the array
        const deletePost = await prisma.post.delete({
            where: {
                id: postsCreated[0].id, // Random ID
            },
        })
    
        // Delete the 2nd two posts
        const deleteManyPosts = await prisma.post.deleteMany({
            where: {
                id: {
                    in: [postsCreated[1].id, postsCreated[2].id],
                },
            },
        })
    
        const getPosts = await prisma.post.findMany({
            where: {
                id: {
                    in: postsCreated.map((x) => x.id),
                },
            },
        })
    
        console.log()
    
        console.log(
            'Deleted post with ID: ' + '\u001b[1;32m' + deletePost.id + '\u001b[0m'
        )
        console.log(
            'Deleted posts with IDs: ' +
            '\u001b[1;32m' +
            [postsCreated[1].id + ',' + postsCreated[2].id] +
            '\u001b[0m'
        )
        console.log()
        console.log(
            'Are the posts still available?: ' +
            (getPosts.length == 3
                ? '\u001b[1;32m' + 'Yes!' + '\u001b[0m'
                : '\u001b[1;31m' + 'No!' + '\u001b[0m')
        )
        console.log()
        console.log('\u001b[1;34m#################################### \u001b[0m')
        // 4. Count ALL posts
        const f = await prisma.post.findMany({})
        console.log('Number of posts: ' + '\u001b[1;32m' + f.length + '\u001b[0m')
    
        // 5. Count DELETED posts
        const r = await prisma.post.findMany({
            where: {
                deleted: true,
            },
        })
    
        console.log(
            'Number of SOFT deleted posts: ' + '\u001b[1;32m' + r.length + '\u001b[0m'
        )
    
    }
    
    main()
    
    
    ```

**✔ Positif dari pendekatan soft delete ini meliputi:**
- Penghapusan lunak terjadi pada tingkat akses data, yang berarti Anda tidak dapat menghapus catatan kecuali Anda menggunakan SQL mentah

**✘ Kontra dari pendekatan penghapusan lunak ini meliputi:**
- Konten masih dapat dibaca dan diperbarui kecuali jika Anda memfilter secara eksplisit ```where: { deleted: false }``` - dalam proyek besar dengan banyak kueri, ada risiko konten yang dihapus sementara akan tetap ditampilkan
- Anda masih dapat menggunakan SQL native untuk menghapus record

### Langkah 3: Secara opsional mencegah pembacaan/pembaruan catatan yang dihapus secara lunak

Pada langkah 2, kami menerapkan middleware yang mencegah ```Post``` rekaman dihapus. Namun, Anda masih dapat membaca dan memperbarui rekaman yang dihapus. Langkah ini mengeksplorasi dua cara untuk mencegah pembacaan dan pemutakhiran rekaman yang dihapus.

```
Catatan : Opsi ini hanyalah ide dengan pro dan kontra, Anda dapat memilih untuk melakukan sesuatu yang sama sekali berbeda.
```
#### Opsi 1: Terapkan filter dalam kode aplikasi Anda sendiri
Dalam opsi ini:
- Middleware Prisma bertanggung jawab untuk mencegah catatan dihapus
- Kode aplikasi Anda sendiri (yang bisa berupa API GraphQL, API REST, modul) bertanggung jawab untuk memfilter posting yang dihapus jika diperlukan ( ) ```{ where: { deleted: false } }```saat membaca dan memperbarui data - misalnya, ```getPost``` penyelesai GraphQL tidak pernah mengembalikan posting yang dihapus

✔ Pro dari pendekatan penghapusan lunak ini meliputi:
- Tidak ada perubahan pada kueri buat/perbarui Prisma - Anda dapat dengan mudah meminta catatan yang dihapus jika Anda membutuhkannya
- Memodifikasi kueri di middleware dapat menimbulkan beberapa konsekuensi yang tidak diinginkan, seperti mengubah jenis pengembalian kueri (lihat opsi 2)

✘ Kontra dari pendekatan penghapusan lunak ini meliputi:
- Logika yang berkaitan dengan soft delete dipertahankan di dua tempat berbeda
- Jika permukaan API Anda sangat besar dan dikelola oleh banyak kontributor, mungkin akan sulit untuk menegakkan aturan bisnis tertentu (misalnya, jangan pernah mengizinkan catatan yang dihapus diperbarui)

#### Opsi 2: Gunakan middleware untuk menentukan perilaku kueri baca/perbarui untuk catatan yang dihapus
Opsi dua menggunakan middleware Prisma untuk mencegah agar catatan yang dihapus lunak tidak dikembalikan. Tabel berikut menjelaskan bagaimana middleware memengaruhi setiap kueri:

| Query             | Middleware logic                                                                                                                                                                                                                                                                                                                                                                                | Changes to return type |
|-------------------|-------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------|------------------------|
| ```findUnique```  | Ubah kueri ke findFirst(karena Anda tidak dapat menerapkan ```deleted: false``` filter ke ```findUnique``` )<br> <br>Tambahkan ```where: { deleted: false }``` filter untuk mengecualikan posting yang dihapus secara halus <br> <br> Dari versi 4.5.0, Anda dapat menggunakan ```findUnique``` untuk menerapkan ```delete: false``` filter dengan ```extendedWhereUnique``` fitur pratinjau.   | Tidak ada perubahan    |
| ```findMany```    | Tambahkan ```where: { deleted: false }``` filter untuk mengecualikan posting yang dihapus secara default secara default <br> <br> zinkan pengembang untuk secara eksplisit meminta posting yang dihapus secara eksplisit dengan menentukan ```deleted: true```                                                                                                                                  | Tidak ada perubahan    |
| ````update````    | Ubah kueri ke ```updateMany``` (karena Anda tidak dapat menerapkan ```deleted: false``` filter ke update) <br> <br> Tambahkan ```where: { deleted: false }``` filter untuk mengecualikan posting yang dihapus                                                                                                                                                                                   | Tidak ada perubahan    |
| ```updateMany```  | Tambahkan where: ```{ deleted: false }``` filter untuk mengecualikan posting yang dihapus                                                                                                                                                                                                                                                                                                       | Tidak ada perubahan    |

**Mengapa Anda memungkinkan untuk digunakan ```findMany``` dengan ```{ where: { deleted: true } }``` filter, tetapi tidak ```updateMany```?**<br>
Sampel khusus ini ditulis untuk mendukung skenario di mana pengguna dapat memulihkan posting blog mereka yang dihapus (yang memerlukan daftar posting yang dihapus sementara) - tetapi pengguna seharusnya tidak dapat mengedit posting yang dihapus.

**Dapatkah saya masih ```connect``` atau ```connectOrCreate``` posting dihapus?** <br>
Dalam sampel ini - ya. Middleware tidak mencegah Anda untuk menghubungkan kiriman yang sudah dihapus secara halus ke pengguna.

Jalankan contoh berikut untuk melihat bagaimana middleware memengaruhi setiap kueri:

```ts
import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient({})

async function main() {
  /***********************************/
  /* SOFT DELETE MIDDLEWARE */
  /***********************************/

  prisma.$use(async (params, next) => {
    if (params.model == 'Post') {
      if (params.action === 'findUnique' || params.action === 'findFirst') {
        // Change to findFirst - you cannot filter
        // by anything except ID / unique with findUnique
        params.action = 'findFirst'
        // Add 'deleted' filter
        // ID filter maintained
        params.args.where['deleted'] = false
      }
      if (params.action === 'findMany') {
        // Find many queries
        if (params.args.where) {
          if (params.args.where.deleted == undefined) {
            // Exclude deleted records if they have not been explicitly requested
            params.args.where['deleted'] = false
          }
        } else {
            params.args['where'] = { deleted: false }
        }
      }
    }
      return next(params)
  })

    prisma.$use(async (params, next) => {
        if (params.model == 'Post') {
            if (params.action == 'update') {
                // Change to updateMany - you cannot filter
                // by anything except ID / unique with findUnique
                params.action = 'updateMany'
                // Add 'deleted' filter
                // ID filter maintained
                params.args.where['deleted'] = false
            }
            if (params.action == 'updateMany') {
                if (params.args.where != undefined) {
                    params.args.where['deleted'] = false
                } else {
                    params.args['where'] = { deleted: false }
                }
            }
        }
        return next(params)
    })

    prisma.$use(async (params, next) => {
        // Check incoming query type
        if (params.model == 'Post') {
            if (params.action == 'delete') {
                // Delete queries
                // Change action to an update
                params.action = 'update'
                params.args['data'] = { deleted: true }
            }
            if (params.action == 'deleteMany') {
                // Delete many queries
                params.action = 'updateMany'
                if (params.args.data != undefined) {
                    params.args.data['deleted'] = true
                } else {
                    params.args['data'] = { deleted: true }
                }
            }
        }
        return next(params)
    })

/***********************************/
/* TEST */
/***********************************/

    const titles = [
        { title: 'How to create soft delete middleware' },
        { title: 'How to install Prisma' },
        { title: 'How to update a record' },
    ]

    console.log('\u001b[1;34mSTARTING SOFT DELETE TEST \u001b[0m')
    console.log('\u001b[1;34m#################################### \u001b[0m')

    let i = 0
    let posts = new Array()

    // Create 3 new posts with a randomly assigned title each time
    for (i == 0; i < 3; i++) {
        const createPostOperation = prisma.post.create({
            data: titles[Math.floor(Math.random() * titles.length)],
        })
        posts.push(createPostOperation)
    }

    var postsCreated = await prisma.$transaction(posts)

    console.log(
        'Posts created with IDs: ' +
        '\u001b[1;32m' +
        postsCreated.map((x) => x.id) +
        '\u001b[0m'
    )

    // Delete the first post from the array
    const deletePost = await prisma.post.delete({
        where: {
            id: postsCreated[0].id, // Random ID
        },
    })

    // Delete the 2nd two posts
    const deleteManyPosts = await prisma.post.deleteMany({
        where: {
            id: {
                in: [postsCreated[1].id, postsCreated[2].id],
            },
        },
    })

    const getOnePost = await prisma.post.findUnique({
        where: {
            id: postsCreated[0].id,
        },
    })

    const getPosts = await prisma.post.findMany({
        where: {
            id: {
                in: postsCreated.map((x) => x.id),
            },
        },
    })

    const getPostsAnDeletedPosts = await prisma.post.findMany({
        where: {
            id: {
                in: postsCreated.map((x) => x.id),
            },
            deleted: true,
        },
    })

    const updatePost = await prisma.post.update({
        where: {
            id: postsCreated[1].id,
        },
        data: {
            title: 'This is an updated title (update)',
        },
    })

    const updateManyDeletedPosts = await prisma.post.updateMany({
        where: {
            deleted: true,
            id: {
                in: postsCreated.map((x) => x.id),
            },
        },
        data: {
            title: 'This is an updated title (updateMany)',
        },
    })

    console.log()

    console.log(
        'Deleted post (delete) with ID: ' +
        '\u001b[1;32m' +
        deletePost.id +
        '\u001b[0m'
    )
    console.log(
        'Deleted posts (deleteMany) with IDs: ' +
        '\u001b[1;32m' +
        [postsCreated[1].id + ',' + postsCreated[2].id] +
        '\u001b[0m'
    )

    console.log()
    console.log(
        'findUnique: ' +
        (getOnePost?.id != undefined
            ? '\u001b[1;32m' + 'Posts returned!' + '\u001b[0m'
            : '\u001b[1;31m' +
            'Post not returned!' +
            '(Value is: ' +
            JSON.stringify(getOnePost) +
            ')' +
            '\u001b[0m')
    )
    console.log(
        'findMany: ' +
        (getPosts.length == 3
            ? '\u001b[1;32m' + 'Posts returned!' + '\u001b[0m'
            : '\u001b[1;31m' + 'Posts not returned!' + '\u001b[0m')
    )
    console.log(
        'findMany ( delete: true ): ' +
        (getPostsAnDeletedPosts.length == 3
            ? '\u001b[1;32m' + 'Posts returned!' + '\u001b[0m'
            : '\u001b[1;31m' + 'Posts not returned!' + '\u001b[0m')
    )
    console.log()

    console.log(
        'update: ' +
        (updatePost.id != undefined
            ? '\u001b[1;32m' + 'Post updated!' + '\u001b[0m'
            : '\u001b[1;31m' +
            'Post not updated!' +
            '(Value is: ' +
            JSON.stringify(updatePost) +
            ')' +
            '\u001b[0m')
    )
    console.log(
        'updateMany ( delete: true ): ' +
        (updateManyDeletedPosts.count == 3
            ? '\u001b[1;32m' + 'Posts updated!' + '\u001b[0m'
            : '\u001b[1;31m' + 'Posts not updated!' + '\u001b[0m')
    )
    console.log()
    console.log('\u001b[1;34m#################################### \u001b[0m')
    // 4. Count ALL posts
    const f = await prisma.post.findMany({})
    console.log(
        'Number of active posts: ' + '\u001b[1;32m' + f.length + '\u001b[0m'
    )

    // 5. Count DELETED posts
    const r = await prisma.post.findMany({
        where: {
            deleted: true,
        },
    })
    console.log(
        'Number of SOFT deleted posts: ' + '\u001b[1;32m' + r.length + '\u001b[0m'
    )
}

main()


```


**✔ Pro dari pendekatan ini:**

- Pengembang dapat membuat pilihan sadar untuk memasukkan catatan yang dihapus ```findMany```
- Anda tidak dapat secara tidak sengaja membaca atau memperbarui catatan yang dihapus

**✖ Kontra dari pendekatan ini:**

- Tidak jelas dari API bahwa Anda tidak mendapatkan semua rekaman dan itu ```{ where: { deleted: false } }``` adalah bagian dari kueri default
- Jenis pengembalian ```update``` terpengaruh karena middleware mengubah kueri menjadiupdateMany
- Tidak menangani kueri kompleks dengan ```AND```, ```OR```, ```every```, dll...
- Tidak menangani pemfilteran saat menggunakan ```include``` dari model lain.


Referensi:

https://www.prisma.io/docs/concepts/components/prisma-client/middleware/soft-delete-middleware
