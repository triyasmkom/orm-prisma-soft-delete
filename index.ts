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
