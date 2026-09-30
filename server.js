import express from 'express';

const app = express();
app.use(express.json());
app.use(express.static('dist'));

const trips = [
  { id: 1, from: 'ศรีราชา', to: 'กรุงเทพฯ', time: '07:30', arrival: '09:45', price: 180, seats: 12, type: 'รถตู้ VIP' },
  { id: 2, from: 'ศรีราชา', to: 'กรุงเทพฯ', time: '10:00', arrival: '12:15', price: 180, seats: 8, type: 'รถตู้ VIP' },
  { id: 3, from: 'ศรีราชา', to: 'พัทยา', time: '13:30', arrival: '14:15', price: 80, seats: 16, type: 'มินิบัส' },
];

app.get('/api/trips', (req, res) => res.json(trips));
app.post('/api/bookings', (req, res) => {
  const { tripId, seats = [], passenger = {} } = req.body;
  const trip = trips.find((item) => item.id === Number(tripId));
  if (!trip || !seats.length) return res.status(400).json({ error: 'Please select a trip and at least one seat.' });
  const code = `ST${Date.now().toString().slice(-6)}`;
  res.status(201).json({ code, status: 'pending_payment', total: trip.price * seats.length, trip, seats, passenger });
});
app.post('/api/payments', (req, res) => res.json({ status: 'paid', ticket: `ET-${req.body.code || 'SR123456'}` }));
app.get('/{*splat}', (req, res) => res.sendFile(new URL('./dist/index.html', import.meta.url).pathname));

app.listen(process.env.PORT || 3000, () => console.log('Sriracha Tour server running'));
