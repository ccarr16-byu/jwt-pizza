import { test, expect } from 'playwright-test-coverage';

async function basicInit(page) {
  let loggedInUser;
  const validUsers = { 'd@jwt.com': { id: '3', name: 'Kai Chen', email: 'd@jwt.com', password: 'diner', roles: [{ role: 'diner' }] }, 'a@jwt.com': { id: '1', name: '常用名字', email: 'a@jwt.com', password: 'admin', roles: [{ role: 'admin' }] }, 'f@jwt.com': { id: '3', name: 'pizza franchisee', email: 'f@jwt.com', password: 'franchisee', roles: [{ role: 'diner' }, { objectId: 1, role: 'franchisee' }] } };

  // Authorize login for the given user
  await page.route('*/**/api/auth', async (route) => {
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
  });

  // Return the currently logged in user
  await page.route('*/**/api/user/me', async (route) => {
    expect(route.request().method()).toBe('GET');
    await route.fulfill({ json: loggedInUser });
  });

  // A standard menu
  await page.route('*/**/api/order/menu', async (route) => {
    const menuRes = [
      {
        id: 1,
        title: 'Veggie',
        image: 'pizza1.png',
        price: 0.0038,
        description: 'A garden of delight',
      },
      {
        id: 2,
        title: 'Pepperoni',
        image: 'pizza2.png',
        price: 0.0042,
        description: 'Spicy treat',
      },
    ];
    expect(route.request().method()).toBe('GET');
    await route.fulfill({ json: menuRes });
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

  // User franchises and stores
  await page.route(/\/api\/franchise\/([0-9]*)/, async (route) => {
    const userFranchiseRes = 
      [
        {
          id: 1,
          name: 'pizzaPocket',
          admins: [
              {
                  id: 3,
                  name: 'pizza franchisee',
                  email: 'f@jwt.com',
              }
          ],
          stores: [
              {
                  id: 1,
                  name: 'SLC',
                  totalRevenue: 0,
              },
          ]
        }
      ];
    expect(route.request().method()).toBe('GET');
    await route.fulfill({ json: userFranchiseRes });
  });

  // Order a pizza.
  await page.route('*/**/api/order', async (route) => {
    const orderReq = route.request().postDataJSON();
    const orderRes = {
      order: { ...orderReq, id: 23 },
      jwt: 'eyJpYXQ',
    };
    expect(route.request().method()).toBe('POST');
    await route.fulfill({ json: orderRes });
  });

  await page.goto('/');
}

test('home page', async ({ page }) => {
  await page.goto('/');

  expect(await page.title()).toBe('JWT Pizza');
});

test('login', async ({ page }) => {
  await basicInit(page);
  await page.getByRole('link', { name: 'Login' }).click();
  await page.getByRole('textbox', { name: 'Email address' }).fill('d@jwt.com');
  await page.getByRole('textbox', { name: 'Password' }).fill('diner');
  await page.getByRole('button', { name: 'Login' }).click();

  await expect(page.getByRole('link', { name: 'KC' })).toBeVisible();
});

test('purchase with login', async ({ page }) => {
  await basicInit(page);

  // Go to order page
  await page.getByRole('button', { name: 'Order now' }).click();

  // Create order
  await expect(page.locator('h2')).toContainText('Awesome is a click away');
  await page.getByRole('combobox').selectOption('4');
  await page.getByRole('link', { name: 'Image Description Veggie A' }).click();
  await page.getByRole('link', { name: 'Image Description Pepperoni' }).click();
  await expect(page.locator('form')).toContainText('Selected pizzas: 2');
  await page.getByRole('button', { name: 'Checkout' }).click();

  // Login
  await page.getByPlaceholder('Email address').click();
  await page.getByPlaceholder('Email address').fill('d@jwt.com');
  await page.getByPlaceholder('Email address').press('Tab');
  await page.getByPlaceholder('Password').fill('diner');
  await page.getByRole('button', { name: 'Login' }).click();

  // Pay
  await expect(page.getByRole('main')).toContainText('Send me those 2 pizzas right now!');
  await expect(page.locator('tbody')).toContainText('Veggie');
  await expect(page.locator('tbody')).toContainText('Pepperoni');
  await expect(page.locator('tfoot')).toContainText('0.008 ₿');
  await page.getByRole('button', { name: 'Pay now' }).click();

  // Check balance
  await expect(page.getByText('0.008')).toBeVisible();
});

test('admin login', async ({ page }) => {
  await basicInit(page);
  await page.getByRole('link', { name: 'Login' }).click();
  await page.getByRole('textbox', { name: 'Email address' }).fill('a@jwt.com');
  await page.getByRole('textbox', { name: 'Password' }).fill('admin');
  await page.getByRole('button', { name: 'Login' }).click();await expect(page.getByRole('link', { name: 'Admin' })).toBeVisible();
  await page.getByRole('link', { name: 'Admin' }).click();

  await expect(page.locator('h2')).toContainText('Mama Ricci\'s kitchen');
});

test('franchisee login', async ({ page }) => {
  await basicInit(page);
  await page.getByRole('link', { name: 'Login' }).click();
  await page.getByRole('textbox', { name: 'Email address' }).fill('f@jwt.com');
  await page.getByRole('textbox', { name: 'Password' }).fill('franchisee');
  await page.getByRole('button', { name: 'Login' }).click();
  await page.getByLabel('Global').getByRole('link', { name: 'Franchise' }).click();
  await expect(page.getByRole('button', { name: 'Create store' })).toBeVisible();
  await expect(page.getByRole('heading')).toContainText('pizzaPocket');


  await page.getByRole('button', { name: 'Create store' }).click();
  await expect(page.getByRole('textbox', { name: 'store name' })).toBeVisible();
});

test('register stub', async ({ page }) => {
  await basicInit(page);
  await page.getByRole('link', { name: 'Register' }).click();
  await expect(page.getByText('Welcome to the party')).toBeVisible();
  await page.getByRole('textbox', { name: 'Full name' }).click();
  await page.getByRole('textbox', { name: 'Full name' }).fill('test');
  await page.getByRole('textbox', { name: 'Email address' }).click();
  await page.getByRole('textbox', { name: 'Email address' }).fill('test@jwt.com');
  await page.getByRole('textbox', { name: 'Password' }).click();
  await page.getByRole('textbox', { name: 'Password' }).fill('test');
  await page.getByRole('button', { name: 'Register' }).click();
});

test('click around no login', async ({ page }) => {
  await basicInit(page);
  await page.getByRole('link', { name: 'About' }).click();
  await page.getByRole('link', { name: 'History' }).click();
  await page.getByRole('contentinfo').getByRole('link', { name: 'Franchise' }).click();
  await page.getByRole('link', { name: 'Order' }).click();
});