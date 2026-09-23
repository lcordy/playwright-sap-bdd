Feature: Login
  
  Background:
    Given the user is on the login page already

  Scenario: User are logging in with valid credentials
    When the user enters username "admin" in the username field
    And the user enters the password what is "password123"
    And the user clicks on the login button for submitting
    Then the user should be able to logged in successfully
    And the user dashboard should displays all information

  Scenario: User tries to login with wrong password are failing
    When the user are entering username "admin"
    And the user enters the wrong password "wrongpass"
    And the user do click the login button
    Then an error message should be showing to the user
    And the user should not able to log in