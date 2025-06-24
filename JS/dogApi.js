// dogApi.js
const axios = require('axios');

const API_KEY = 'DEMO-API-KEY'; // I did use ai to get api to use it in my project
const BASE_URL = 'https://api.thedogapi.com/v1';

async function searchBreedInfo(breedName) {
  try {
    const res = await axios.get(`${BASE_URL}/breeds/search?q=${breedName}`, {
      headers: { 'x-api-key': API_KEY }
    });

    if (res.data.length === 0) return null;

    const breed = res.data[0];
    return {
      name: breed.name,
      lifespan: breed.life_span,
      temperament: breed.temperament,
      height: breed.height.metric,
      weight: breed.weight.metric
    };
  } catch (err) {
    console.error("Fehler bei TheDogAPI:", err);
    return null;
  }
}

async function getBreedImage(breedName) {
  try {
    const res = await axios.get(`${BASE_URL}/breeds/search?q=${breedName}`, {
      headers: { 'x-api-key': API_KEY }
    });

    if (res.data.length === 0) return null;

    const breedId = res.data[0].id;

    const imageRes = await axios.get(`${BASE_URL}/images/search?breed_id=${breedId}`, {
      headers: { 'x-api-key': API_KEY }
    });

    return imageRes.data[0]?.url || null;
  } catch (err) {
    console.error("Fehler bei Bildabruf:", err);
    return null;
  }
}

module.exports = { searchBreedInfo, getBreedImage };
