import { test, expect } from 'playwright-test-coverage';

async function basicInit(page) {
  let loggedInUser;
  let validUsers = { 'd@jwt.com': { id: '3', name: 'Kai Chen', email: 'd@jwt.com', password: 'diner', roles: [{ role: 'diner' }] }, 'a@jwt.com': { id: '1', name: '常用名字', email: 'a@jwt.com', password: 'admin', roles: [{ role: 'admin' }] }, 'f@jwt.com': { id: '3', name: 'pizza franchisee', email: 'f@jwt.com', password: 'franchisee', roles: [{ role: 'diner' }, { objectId: 1, role: 'franchisee' }] }, 'u@jwt.com': { id: '4', name: 'test user', email: 'u@jwt.com', password: 'user', roles: [{ role: 'diner' }] } };

  // Authorize login for the given user
  await page.route('*/**/api/auth', async (route) => {
    if (route.request().method() === 'DELETE') {
      const logoutRes = { message: 'logout successful' };
      await route.fulfill({ json: logoutRes });
    } else {
      const loginReq = route.request().postDataJSON();
      const user = validUsers[loginReq.email];
      if (!user || user.password !== loginReq.password) {
        await route.fulfill({ status: 401, json: { error: 'Unauthorized' } });
        return;
      }
      loggedInUser = validUsers[loginReq.email];
      const loginRes = {
        user: loggedInUser,
        token: 'abcdef',
      };
      expect(route.request().method()).toBe('PUT');
      await route.fulfill({ json: loginRes });
    }
  });

  // Standard franchises and stores
  await page.route(/\/api\/franchise(\?.*)?$/, async (route) => {
    const franchiseRes = {
      franchises: [
        {
          id: 1,
            name: 'pizzaPocket',
            admins: [
                {
                    id: 3,
                    name: 'pizza franchisee',
                    email: 'f@jwt.com'
                }
            ],
            stores: [
                {
                    id: 1,
                    name: 'SLC',
                    totalRevenue: 0
                },
            ]
        },
        {
          id: 2,
          name: 'LotaPizza',
          stores: [
            { id: 4, name: 'Lehi' },
            { id: 5, name: 'Springville' },
            { id: 6, name: 'American Fork' },
          ],
        },
        { id: 3, name: 'PizzaCorp', stores: [{ id: 7, name: 'Spanish Fork' }] },
        { id: 4, name: 'topSpot', stores: [] },
      ],
    };
    expect(route.request().method()).toBe('GET');
    await route.fulfill({ json: franchiseRes });
  });


    await page.route(/\/api\/user\/([0-9]+)/, async (route) => {
        expect(['PUT', 'DELETE']).toContain(route.request().method());
        
        const request = route.request().postDataJSON();
        const match = route.request().url().match(/\/api\/user\/([0-9]+)/);
        const userId = match ? match[1] : null;

        const userEntry = Object.values(validUsers).find((u) => u.id === userId);
        if (!userEntry) {
            await route.fulfill({ status: 404, json: { error: 'User not found' } });
            return;
        }

        if (route.request().method() === 'PUT') {
            Object.assign(userEntry, {
                name: request.name ?? userEntry.name,
                email: request.email ?? userEntry.email,
                password: request.password ?? userEntry.password,
            });

            loggedInUser = userEntry;

            const editRes = {
                user: userEntry,
                token: 'tttttt',
            };

            await route.fulfill({ json: editRes });
        } else if (route.request().method() === 'DELETE') {
           delete validUsers[userEntry.email];
           await route.fulfill({ status: 200, body: '' });
        }
    });

  await page.goto('/');
}

test('updateUser', async ({ page }) => {
    await basicInit(page);
    await page.getByRole('link', { name: 'Login' }).click();
    await page.getByRole('textbox', { name: 'Email address' }).fill('u@jwt.com');
    await page.getByRole('textbox', { name: 'Password' }).fill('user');
    await page.getByRole('button', { name: 'Login' }).click();

    await page.getByRole('link', { name: 'tu' }).click();

    await expect(page.getByRole('main')).toContainText('test user');
    await page.getByRole('button', { name: 'Edit' }).click();
    await expect(page.locator('h3')).toContainText('Edit user');

    await page.getByRole('textbox').first().fill('test userx');
    await page.getByRole('button', { name: 'Update' }).click();

    await expect(page.getByRole('main')).toContainText('test userx');

    await page.getByRole('link', { name: 'Logout' }).click();
    await page.getByRole('link', { name: 'Login' }).click();

    await page.getByRole('textbox', { name: 'Email address' }).fill('u@jwt.com');
    await page.getByRole('textbox', { name: 'Password' }).fill('user');
    await page.getByRole('button', { name: 'Login' }).click();

    await page.getByRole('link', { name: 'tu' }).click();

    await expect(page.getByRole('main')).toContainText('test userx');
});

test('listUsers', async ({ page }) => {
    const userNumber = Math.floor(Math.random() * 10000);
    const name = `user${userNumber}`;
    const email = `${name}@jwt.com`;
    await page.goto('/');
    await page.getByRole('link', { name: 'Register' }).click();
    await page.getByRole('textbox', { name: 'Full name' }).fill(name);
    await page.getByRole('textbox', { name: 'Email address' }).fill(email);
    await page.getByRole('textbox', { name: 'Password' }).fill('diner');
    await page.getByRole('button', { name: 'Register' }).click();
    await page.getByRole('link', { name: 'Logout' }).click();
    await page.getByRole('link', { name: 'Login' }).click();
    await page.getByRole('textbox', { name: 'Email address' }).click();
    await page.getByRole('textbox', { name: 'Email address' }).fill('a@jwt.com');
    await page.getByRole('textbox', { name: 'Email address' }).press('Tab');
    await page.getByRole('textbox', { name: 'Password' }).fill('admin');
    await page.getByRole('button', { name: 'Login' }).click();
    await page.getByRole('link', { name: 'Admin' }).click();
    await expect(page.getByRole('main')).toContainText('Users');
    await page.getByRole('textbox', { name: 'Filter users' }).click();
    await page.getByRole('textbox', { name: 'Filter users' }).fill(name);
    await page.getByRole('button', { name: 'Submit' }).nth(1).click();
    await expect(page.getByRole('main')).toContainText(email);
    await page.getByRole('button', { name: 'Close' }).nth(4).click();
    await expect(page.getByRole('heading')).toContainText('Delete user');
    await expect(page.getByRole('main')).toContainText(name);
    await page.getByRole('button', { name: 'Delete' }).click();
    await expect(page.locator('h2')).toContainText('Mama Ricci\'s kitchen');
    await page.getByRole('textbox', { name: 'Filter users' }).click();
    await page.getByRole('textbox', { name: 'Filter users' }).fill(name);
    await page.getByRole('button', { name: 'Submit' }).nth(1).click();
    await expect(page.getByRole('main')).not.toContainText(email);
})