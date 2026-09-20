Feature: Create Standard Purchase Order
  As a purchasing user
  I want to create a standard Purchase Order with line items and attachments
  So that I can manage supplier orders effectively

  Background:
    Given the user is logged into S/4HANA Cloud
    And the user opens the Manage Purchase Orders app

  Scenario: Create Standard Purchase Order with line item
    When a Standard Purchase Order is created with the following details:
      | Field                   | Value                                                        |
      | Purchasing Doc Type     | Standard PO (NB)                                             |
      | Currency                | AUD                                                          |
      | Purchasing Group        | 001                                                          |
      | Purchasing Organization | 3010                                                         |
      | Company Code            | 3010                                                         |
      | Supplier                | 30300001                                                     |
      | Payment Terms           | 0003                                                         |
      | Header Text             | Automated by Planit Testing - come talk to us to learn more! |
    And a line item is added with the following specifications:
      | Field            | Value      |
      | Material         | TG0011     |
      | Plant            | 3010       |
      | Quantity         | 10         |
      | Price            | 100        |
      | Storage Location | 301A       |
      | Delivery Date    | in 10 days |
    And an attachment "order-confirmation.pdf" is added to the Purchase Order
    When the Purchase Order is submitted
    Then the Purchase Order should be successfully created